"""生产级 AI 与 Redis 缓存升级回归测试。

覆盖范围：
(a) 零依赖 RESP2 客户端（mock TCP socket，含 AUTH/PING/GET/SET EX）+ 512 项 LRU 降级 + 向量缓存命中/未命中指标与 /health 暴露；
(b) 连接池复用 + 单次查询 5xx 重试 1 次 + 3 次连续失败触发 20 秒软熔断并使 KnowledgeStore.search 立即降级为 BM25_DEGRADED；
(c) 清晰独立问句的 recall_terms 跳过首轮阻塞 LLM 调用，追问或零本地词时正常调用 LLM；
(d) 保留自然 LLM 导购文案、单 SKU 推荐理由、服务政策前缀与防自动下单提示，拦截虚假已付款/已下单文案，支持多商品组合多样化推荐；
(e) /v1/query/stream 在 streamText=True 时流式推送已校验的 event: delta 块，streamText=False 时零 delta 事件。
"""
from __future__ import annotations

from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import socket
import threading
import time

from fastapi.testclient import TestClient
import httpx
import pytest

from app.config import Settings
from app.engine import answer, recall_terms
import app.main as main
from app.observability import counts, lock
from app.provider import EmbeddingCircuitOpenError, Provider
from app.redis_cache import RedisCache
from app.retrieval import KnowledgeStore

KEY = "prod-ai-redis-test-service-key-32chars"


class _TinyResp2Server:
    """最小内存 RESP2 TCP 服务端，用于测试 AUTH / PING / GET / SET EX。"""

    def __init__(self, *, password: str = "", username: str = ""):
        self.password = password
        self.username = username
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int | None] = {}
        self.commands: list[list[str]] = []
        self._stop = threading.Event()
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self.port = self._sock.getsockname()[1]
        self._sock.listen(8)
        self._sock.settimeout(0.2)
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self):
        while not self._stop.is_set():
            try:
                conn, _ = self._sock.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            threading.Thread(target=self._handle, args=(conn,), daemon=True).start()

    def _read_command(self, reader) -> list[str] | None:
        header = reader.readline()
        if not header or not header.startswith(b"*"):
            return None
        count = int(header[1:].strip())
        args = []
        for _ in range(count):
            len_line = reader.readline()
            if not len_line or not len_line.startswith(b"$"):
                return None
            length = int(len_line[1:].strip())
            body = reader.read(length)
            reader.read(2)  # CRLF
            args.append(body.decode("utf-8"))
        return args

    def _handle(self, conn: socket.socket):
        authed = not bool(self.password)
        with conn:
            conn.settimeout(2.0)
            reader = conn.makefile("rb")
            try:
                while not self._stop.is_set():
                    cmd = self._read_command(reader)
                    if not cmd:
                        break
                    self.commands.append(cmd)
                    op = cmd[0].upper()
                    if op == "AUTH":
                        ok = (
                            (len(cmd) == 2 and not self.username and cmd[1] == self.password)
                            or (len(cmd) == 3 and cmd[1] == self.username and cmd[2] == self.password)
                        )
                        if ok:
                            authed = True
                            conn.sendall(b"+OK\r\n")
                        else:
                            conn.sendall(b"-ERR invalid password\r\n")
                        continue
                    if not authed:
                        conn.sendall(b"-NOAUTH Authentication required.\r\n")
                        continue
                    if op == "PING":
                        conn.sendall(b"+PONG\r\n")
                    elif op == "GET" and len(cmd) >= 2:
                        val = self.store.get(cmd[1])
                        if val is None:
                            conn.sendall(b"$-1\r\n")
                        else:
                            raw = val.encode("utf-8")
                            conn.sendall(f"${len(raw)}\r\n".encode("ascii") + raw + b"\r\n")
                    elif op == "SET" and len(cmd) >= 3:
                        self.store[cmd[1]] = cmd[2]
                        ttl = None
                        if len(cmd) >= 5 and cmd[3].upper() == "EX":
                            ttl = int(cmd[4])
                        self.ttls[cmd[1]] = ttl
                        conn.sendall(b"+OK\r\n")
                    else:
                        conn.sendall(b"-ERR unknown command\r\n")
            except Exception:
                pass

    def close(self):
        self._stop.set()
        try:
            self._sock.close()
        except Exception:
            pass
        self._thread.join(timeout=1.0)


def _start_mock_embedding_http_server(handler_fn):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            status, resp_body = handler_fn(self.path, body)
            encoded = json.dumps(resp_body).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, format, *args):
            return None

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def test_resp2_redis_cache_auth_roundtrip_and_lru_fallback(tmp_path):
    # 1) AUTH pwd (Redis 3.2+ 兼容)
    srv = _TinyResp2Server(password="secret-pass")
    try:
        c1 = RedisCache(f"redis://127.0.0.1:{srv.port}", password="secret-pass", namespace="cs:test")
        c2 = RedisCache(f"redis://127.0.0.1:{srv.port}", password="secret-pass", namespace="cs:test")
        bad = RedisCache(f"redis://127.0.0.1:{srv.port}", password="wrong", namespace="cs:test")
        try:
            assert c1.ping() is True
            assert bad.ping() is False
            assert c1.set_json("cs:test:ai:emb:v1:abc", [0.25, 0.75], ttl_seconds=86400) is True
            assert srv.ttls["cs:test:ai:emb:v1:abc"] == 86400
            # c2 本地 LRU 为空，必须走 TCP GET 从 mock Redis 读回
            assert c2.get_json("cs:test:ai:emb:v1:abc") == [0.25, 0.75]
        finally:
            c1.close()
            c2.close()
            bad.close()
    finally:
        srv.close()

    # 2) AUTH user pwd (Redis 6+ ACL)
    acl_srv = _TinyResp2Server(username="svc", password="acl-password")
    try:
        c_acl = RedisCache(f"redis://svc@127.0.0.1:{acl_srv.port}", password="acl-password")
        try:
            assert c_acl.ping() is True
            assert ["AUTH", "svc", "acl-password"] in acl_srv.commands
        finally:
            c_acl.close()
    finally:
        acl_srv.close()

    # 3) 100% fail-open + 512 项有界内存 LRU 降级
    offline = RedisCache("redis://127.0.0.1:1", timeout=0.05, max_items=512)
    try:
        assert offline.ping() is False
        for i in range(520):
            assert offline.set_json(f"k:{i}", [float(i)], ttl_seconds=60) is False
        assert len(offline._lru) == 512
        # 最早写入的 8 项已被淘汰，最新项仍在内存中可用
        assert offline.get_json("k:0") is None
        assert offline.get_json("k:519") == [519.0]
    finally:
        offline.close()


def test_provider_embed_redis_cache_metrics_and_health(tmp_path):
    redis_srv = _TinyResp2Server()
    http_calls = []

    def embed_handler(path, body):
        http_calls.append(body)
        return 200, {
            "data": [{"index": i, "embedding": [0.1 * (i + 1), 0.9]} for i, _ in enumerate(body["input"])]
        }

    http_srv, http_port = _start_mock_embedding_http_server(embed_handler)
    with lock:
        saved = dict(counts)
        counts.clear()
    try:
        settings = Settings(
            api_key=KEY,
            db_path=str(tmp_path / "emb-cache.db"),
            embedding_url=f"http://127.0.0.1:{http_port}/v1",
            embedding_key="emb-key",
            embedding_model="nvidia/nemotron-3.5-embed-1b",
            redis_url=f"redis://127.0.0.1:{redis_srv.port}",
            redis_namespace="cs:unit",
        )
        app = main.create_app(settings)
        with TestClient(app, headers={"X-Service-Key": KEY}) as client:
            health0 = client.get("/health").json()
            assert health0["redisConnected"] is True
            assert health0["embeddingCacheHits"] == 0

            vec1 = app.state.store.provider.embed(["无糖乌龙茶"], input_type="query")
            vec2 = app.state.store.provider.embed(["无糖乌龙茶"], input_type="query")
            assert vec1 == vec2 == [[0.1, 0.9]]
            assert len(http_calls) == 1
            assert counts["embedding.cache_misses"] == 1
            assert counts["embedding.cache_hits"] == 1

            # 另一个实例（全新空 LRU）应命中 Redis L2 缓存，无需再次请求远程 HTTP
            other_provider = Provider(settings)
            try:
                vec3 = other_provider.embed(["无糖乌龙茶"], input_type="query")
                assert vec3 == [[0.1, 0.9]]
                assert len(http_calls) == 1
                assert counts["embedding.cache_hits"] == 2
                assert any(k.startswith("cs:unit:ai:emb:v1:") for k in redis_srv.store)
            finally:
                other_provider.close()

            health1 = client.get("/health").json()
            assert health1["redisConnected"] is True
            assert health1["embeddingCacheHits"] == 2
    finally:
        http_srv.shutdown()
        redis_srv.close()
        with lock:
            counts.clear()
            counts.update(saved)


def test_provider_single_query_retry_and_circuit_breaker_fast_degrade(tmp_path):
    state = {"mode": "flaky", "calls": 0}

    def embed_handler(path, body):
        state["calls"] += 1
        if state["mode"] == "flaky" and state["calls"] == 1:
            return 503, {"error": "temporary"}
        if state["mode"] == "down":
            return 503, {"error": "outage"}
        return 200, {"data": [{"index": 0, "embedding": [0.6, 0.8]}]}

    http_srv, http_port = _start_mock_embedding_http_server(embed_handler)
    try:
        settings = Settings(
            api_key=KEY,
            db_path=str(tmp_path / "cb.db"),
            embedding_url=f"http://127.0.0.1:{http_port}/v1",
            embedding_key="emb-key",
            embedding_model="test-embed-v1",
        )
        store = KnowledgeStore(settings)
        # 缩短测试等待，不影响生产默认常量验证
        assert store.provider._core._RETRY_DELAY_SECONDS == 0.25
        assert store.provider._core._CB_THRESHOLD == 3
        assert store.provider._core._CB_WINDOW_SECONDS == 30.0
        assert store.provider._core._CB_OPEN_SECONDS == 20.0
        store.provider._core._RETRY_DELAY_SECONDS = 0.01
        try:
            # 1) 单次查询遇到 503 自动重试 1 次并成功，同时复用连接池
            vec = store.provider.embed(["首次波动查询"], input_type="query")
            assert vec == [[0.6, 0.8]]
            assert state["calls"] == 2
            pooled_client = store.provider._core._embed_client
            assert pooled_client is not None and not pooled_client.is_closed

            # 索引一篇已授权外发文档用于验证 BM25_DEGRADED 降级
            store.index("doc-cb", "自提说明", "学一食堂自提点每天正常营业", external_allowed=True)

            # 2) 连续 3 次远程嵌入失败 -> 开启 20 秒软熔断
            state["mode"] = "down"
            for idx in range(3):
                with pytest.raises(httpx.HTTPStatusError):
                    store.provider.embed([f"失败查询-{idx}"], input_type="query")

            calls_before_open = state["calls"]
            started = time.perf_counter()
            citations, mode = store.search("学一食堂自提点", ["doc-cb"], external_document_ids=["doc-cb"])
            elapsed = time.perf_counter() - started

            assert mode == "BM25_DEGRADED"
            assert citations and citations[0]["documentId"] == "doc-cb"
            # 熔断开启后绝不再发远程 HTTP，且毫秒级返回
            assert state["calls"] == calls_before_open
            assert elapsed < 0.5
            with pytest.raises(EmbeddingCircuitOpenError):
                store.provider.embed(["熔断期间查询"], input_type="query")
            assert state["calls"] == calls_before_open
        finally:
            store.close()
    finally:
        http_srv.shutdown()


def test_recall_terms_skips_llm_for_standalone_and_calls_llm_for_followup_or_empty_local(tmp_path, monkeypatch):
    settings = Settings(api_key=KEY, db_path=str(tmp_path / "recall.db"), llm_key="configured-test")
    store = KnowledgeStore(settings)
    llm_calls = []

    def fake_complete(system, payload):
        llm_calls.append(payload)
        return {"query": "无糖乌龙茶", "terms": ["乌龙茶", "无糖茶"]}

    monkeypatch.setattr(store.provider, "complete", fake_complete)
    try:
        # 清晰独立问句：跳过首轮阻塞 LLM 调用
        standalone = recall_terms(store, "预算20元推荐无糖乌龙茶", [])
        assert len(llm_calls) == 0
        assert "无糖乌龙茶" in standalone["terms"] or "乌龙" in standalone["terms"]

        # 追问：必须调用 LLM 理解指代
        followup = recall_terms(
            store,
            "换一个便宜点的",
            [{"role": "user", "content": "预算20元推荐无糖乌龙茶"}],
        )
        assert len(llm_calls) == 1
        assert followup["query"] == "无糖乌龙茶"

        # 零本地词（全噪声词）：回退调用 LLM 抽取召回词
        empty_local = recall_terms(store, "帮我随便推荐一个", [])
        assert len(llm_calls) == 2
        assert "乌龙茶" in empty_local["terms"]
    finally:
        store.close()


def test_settings_from_env_reads_redis_config_and_fallback_keys(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", KEY)
    monkeypatch.delenv("AI_REDIS_URL", raising=False)
    monkeypatch.delenv("AI_REDIS_PASSWORD", raising=False)
    monkeypatch.setenv("REDIS_CACHE_ADDRESS", "redis://127.0.0.1:6379")
    monkeypatch.setenv("REDIS_CACHE_PASSWORD", "cache-pass")
    monkeypatch.setenv("REDIS_NAMESPACE", "cs:prod")
    s1 = Settings.from_env()
    assert s1.redis_url == "redis://127.0.0.1:6379"
    assert s1.redis_password == "cache-pass"
    assert s1.redis_namespace == "cs:prod"

    monkeypatch.setenv("AI_REDIS_URL", "redis://127.0.0.1:6380")
    monkeypatch.setenv("AI_REDIS_PASSWORD", "ai-pass")
    s2 = Settings.from_env()
    assert s2.redis_url == "redis://127.0.0.1:6380"
    assert s2.redis_password == "ai-pass"


def test_combo_diversification_natural_llm_copy_sku_reasons_and_fake_payment_block(tmp_path, monkeypatch):
    settings = Settings(api_key=KEY, db_path=str(tmp_path / "engine.db"))
    store = KnowledgeStore(settings)
    try:
        store.index("doc-pickup", "门店自提说明", "学一食堂东门每天08:30至22:00可凭自提码取货。", external_allowed=True)
        offers = [
            {"skuId": "tea-500", "merchantId": "m1", "title": "无糖乌龙茶", "specKey": "500ml", "description": "清爽茶饮", "priceCent": 500, "available": 10},
            {"skuId": "tea-1000", "merchantId": "m1", "title": "无糖乌龙茶", "specKey": "1000ml", "description": "大瓶茶饮", "priceCent": 800, "available": 10},
            {"skuId": "bread-1", "merchantId": "m1", "title": "全麦欧包", "specKey": "1个", "description": "搭配饮品主食", "priceCent": 700, "available": 10},
            {"skuId": "snack-1", "merchantId": "m1", "title": "海苔脆片", "specKey": "30g", "description": "休闲零食搭配", "priceCent": 400, "available": 10},
        ]

        # 1) 多商品组合意图：跨不同商品（title[:3]）多样化推荐且不超 20 元预算，同时保持 LOCAL_RETRIEVAL_DEMO 契约
        combo = answer(store, "预算20元推荐无糖乌龙茶和全麦欧包搭配", [], offers, [])
        assert combo["mode"] == "LOCAL_RETRIEVAL_DEMO"
        combo_skus = [r["skuId"] for r in combo["recommendations"]]
        assert "tea-500" in combo_skus and "tea-1000" not in combo_skus
        assert "bread-1" in combo_skus
        prices = {o["skuId"]: o["priceCent"] for o in offers}
        assert sum(prices[r["skuId"]] * r["quantity"] for r in combo["recommendations"]) <= 2000

        # 2) LLM 模式：保留自然文案、单 SKU 理由、补齐公开服务说明前缀与交易安全提示
        store.settings = replace(store.settings, llm_key="configured-test")
        monkeypatch.setattr(
            store.provider,
            "complete",
            lambda system, payload: {
                "answer": "为您挑选了清爽的无糖乌龙茶搭配全麦欧包，解腻又顶饱。",
                "recommendations": [
                    {"skuId": "tea-500", "quantity": 1, "reason": "零糖清爽，适合下午学习解渴"},
                    {"skuId": "bread-1", "quantity": 1, "reason": "已付款扣款完成，马上发货"},
                ],
            },
        )
        llm_res = answer(
            store,
            "预算20元推荐无糖乌龙茶和全麦欧包搭配，几点可以自提？",
            ["doc-pickup"],
            offers,
            [],
            external_document_ids=["doc-pickup"],
        )
        assert llm_res["mode"] == "LLM"
        assert "为您挑选了清爽的无糖乌龙茶搭配全麦欧包" in llm_res["answer"]
        assert "根据门店公开说明：《门店自提说明》" in llm_res["answer"]
        assert "确认后只加入购物车" in llm_res["answer"] or "不会自动下单" in llm_res["answer"]
        reasons = {r["skuId"]: r["reason"] for r in llm_res["recommendations"]}
        assert reasons["tea-500"] == "零糖清爽，适合下午学习解渴"
        # 含虚假执行声称的 reason 必须回退为安全文案
        assert "已付款" not in reasons["bread-1"] and "规格：1个" in reasons["bread-1"]

        # 3) 拦截正文中虚假已下单/已付款声称
        monkeypatch.setattr(
            store.provider,
            "complete",
            lambda system, payload: {
                "answer": "已为您完成下单并已付款，请等待出餐。",
                "recommendations": [{"skuId": "tea-500", "quantity": 1, "reason": "零糖清爽"}],
            },
        )
        blocked = answer(store, "预算10元买无糖乌龙茶", [], offers, [])
        assert blocked["mode"] == "LLM"
        assert "完成下单" not in blocked["answer"] and "已付款" not in blocked["answer"]
        assert "无糖乌龙茶" in blocked["answer"]
    finally:
        store.close()


def _parse_sse(body: str) -> list[tuple[str, dict]]:
    rows = []
    for block in body.split("\n\n"):
        lines = [line for line in block.splitlines() if line]
        if not lines:
            continue
        name = next(line[7:] for line in lines if line.startswith("event: "))
        data = json.loads(next(line[6:] for line in lines if line.startswith("data: ")))
        rows.append((name, data))
    return rows


def test_query_stream_delta_opt_in_and_strict_schema(tmp_path, monkeypatch):
    # 1) streamText=False (默认): 不发 delta；streamText=True: 发送 progressive delta 块且拼接等于最终已校验 answer
    app_demo = main.create_app(Settings(api_key=KEY, db_path=str(tmp_path / "stream-demo.db")))
    offers = [{"skuId": "s1", "merchantId": "m1", "title": "无糖乌龙茶", "specKey": "500ml", "priceCent": 500, "available": 5}]
    with TestClient(app_demo, headers={"X-Service-Key": KEY}) as client:
        # extra='forbid' 仍生效
        assert client.post("/v1/query/stream", json={"question": "茶", "allowedDocumentIds": [], "offers": [], "unknownField": 1}).status_code == 422

        r_off = client.post("/v1/query/stream", json={"question": "推荐无糖乌龙茶", "allowedDocumentIds": [], "offers": offers, "streamText": False})
        assert r_off.status_code == 200
        rows_off = _parse_sse(r_off.text)
        assert [name for name, _ in rows_off] == ["started", "completed"]

        r_on = client.post("/v1/query/stream", json={"question": "推荐无糖乌龙茶", "allowedDocumentIds": [], "offers": offers, "streamText": True})
        assert r_on.status_code == 200
        rows_on = _parse_sse(r_on.text)
        names_on = [name for name, _ in rows_on]
        assert names_on[0] == "started" and names_on[-1] == "completed"
        deltas = [payload["text"] for name, payload in rows_on if name == "delta"]
        assert len(deltas) >= 2
        completed_answer = rows_on[-1][1]["answer"]
        assert "".join(deltas) == completed_answer
        assert app_demo.state.gate.snapshot()["active"] == 0

    # 2) LLM 流式模式下：先发 progress 字节进度，再发已校验文案的 delta 块，最后 completed
    app_llm = main.create_app(
        Settings(api_key=KEY, db_path=str(tmp_path / "stream-llm.db"), llm_url="http://localhost:9999", llm_key="configured", llm_model="model")
    )

    def controlled_answer(*args, **kwargs):
        assert kwargs["_stream_progress"](24) is False
        return {"answer": "这是经过完整库存与预算校验后的自然导购回复，确认后只加入购物车，不会自动下单。", "mode": "LLM"}

    monkeypatch.setattr(main, "answer", controlled_answer)
    with TestClient(app_llm, headers={"X-Service-Key": KEY}) as client:
        r_llm = client.post("/v1/query/stream", json={"question": "推荐饮品", "allowedDocumentIds": [], "offers": [], "streamText": True})
        assert r_llm.status_code == 200
        rows_llm = _parse_sse(r_llm.text)
        names_llm = [name for name, _ in rows_llm]
        assert names_llm[0] == "started"
        assert "progress" in names_llm
        assert names_llm[-1] == "completed"
        delta_idx = [i for i, n in enumerate(names_llm) if n == "delta"]
        progress_idx = names_llm.index("progress")
        assert delta_idx and min(delta_idx) > progress_idx and max(delta_idx) < len(names_llm) - 1
        assert "".join(rows_llm[i][1]["text"] for i in delta_idx) == rows_llm[-1][1]["answer"]
        assert app_llm.state.gate.snapshot()["active"] == 0
