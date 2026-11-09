#!/usr/bin/env python3
"""Agent v1.1 M1 独立验收脚本。

默认先运行不触网的协议/边界 Stub，再按私有环境变量尝试真实模型和隔离 Milvus。
脚本不会挂接旧 /ai/chat，不执行购物车/订单写入，也不会把异常正文写入报告。

运行示例：
  python scripts/smoke-agent-v1-1.py --env-file .env
"""
from __future__ import annotations

import argparse
from dataclasses import replace
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import secrets
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))

from app.agent_contract import AgentScope, TOOL_NAME, default_registry
from app.agent_evidence import EvidenceRecorder, assert_isolated_collection, isolated_collection_name, safe_exception_code
from app.agent_provider import OpenAICompatibleToolModel
from app.agent_runtime import AgentModelError, AgentRuntime
from app.config import Settings, validate_service_url
from app.product_index import ProductIndex
from app.provider import Provider


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def live_configured(settings: Settings) -> dict[str, bool]:
    return {
        "llm": bool(settings.llm_url and settings.llm_key and settings.llm_model),
        "embedding": bool(settings.embedding_url and settings.embedding_key and settings.embedding_model),
        "milvus": bool(settings.milvus_uri and settings.milvus_token),
        "serviceKey": bool(settings.api_key),
    }


def scope() -> AgentScope:
    return AgentScope(
        user_id="agent-test-user",
        identity_kind="consumer",
        permissions=frozenset({"catalog.product.search"}),
        authorization_source="test-java-scope",
        turn_token="agent-test-turn",
        turn_expires_at=time.time() + 600,
        lease_checker=lambda token, expires_at: token == "agent-test-turn",
    )


FIXTURES = [
    {"productId": "agent-fixture-pen", "merchantId": "agent-store-a", "title": "考试签字笔", "description": "黑色中性笔", "categoryCode": "stationery", "specs": ["0.5mm"]},
    {"productId": "agent-fixture-tea", "merchantId": "agent-store-a", "title": "无糖乌龙茶", "description": "无糖茶饮", "categoryCode": "drink", "specs": ["500ml"]},
    {"productId": "agent-fixture-notebook", "merchantId": "agent-store-b", "title": "课堂笔记本", "description": "横线笔记本", "categoryCode": "stationery", "specs": ["一本"]},
]


class FixtureSearcher:
    def __init__(self, records=None):
        self.records = list(records or FIXTURES)
        self.calls = 0

    def __call__(self, query, limit, merchant_id, current_scope):
        del query, current_scope
        self.calls += 1
        rows = self.records if merchant_id is None else [row for row in self.records if row["merchantId"] == merchant_id]
        return [
            {
                "productId": row["productId"],
                "merchantId": row["merchantId"],
                "title": row["title"],
                "source": "CATALOG_READ_MODEL",
                "verified": False,
            }
            for row in rows[:limit]
        ]


class ScriptedModel:
    def __init__(self):
        self.calls = 0

    def complete(self, *, messages, tools, metadata):
        del tools, metadata
        self.calls += 1
        if self.calls == 1:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "stub-call-1",
                                    "type": "function",
                                    "function": {"name": "search_products", "arguments": '{"query":"考试签字笔"}'},
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13},
            }
        assert messages[-1]["role"] == "tool"
        return {
            "message": {"role": "assistant", "content": "已返回只读商品候选，请以当前商品页事实为准。"},
            "finish_reason": "stop",
        }

    def stream(self, *, messages, tools, metadata):
        del tools, metadata
        if len(messages) == 1:
            yield {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "stub-stream-1", "function": {"name": "search_products", "arguments": '{"query":'}}]}}]}
            yield {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": '"茶"}'}}]}}]}
            yield {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}
        else:
            yield {"choices": [{"delta": {"content": "已完成只读查询。"}, "finish_reason": "stop"}]}


def run_stub(recorder: EvidenceRecorder) -> None:
    searcher = FixtureSearcher()
    registry = default_registry(searcher)
    runtime = AgentRuntime(ScriptedModel(), registry, model_name="controlled-stub", evidence_status="STUB")

    def native_tool_call():
        result = runtime.run("找考试签字笔", scope())
        if result.status != "COMPLETED" or len(result.tool_calls) != 1 or result.tool_calls[0].status != "SUCCEEDED":
            raise AssertionError("Stub native tool call contract failed")
        return {"toolCalls": len(result.tool_calls), "durationMs": result.duration_ms, "usage": result.usage}

    recorder.check("stub_native_tool_call_and_continued_answer", native_tool_call)

    def streaming_tool_call():
        streamed = AgentRuntime(ScriptedModel(), registry, model_name="controlled-stub", evidence_status="STUB").run_stream("找茶", scope())
        if streamed.status != "COMPLETED" or len(streamed.tool_calls) != 1:
            raise AssertionError("Stub streaming tool call contract failed")
        return {"toolCalls": len(streamed.tool_calls), "durationMs": streamed.duration_ms}

    recorder.check("stub_streaming_tool_arguments_execute_once", streaming_tool_call)

    def no_business_write():
        if searcher.calls != 2:
            raise AssertionError("stub should invoke only the read-only searcher")
        return {"businessWrites": False, "registeredTools": [item["function"]["name"] for item in registry.definitions()]}

    recorder.check("stub_no_business_write", no_business_write)


def run_real_model(recorder: EvidenceRecorder, settings: Settings) -> None:
    if not live_configured(settings)["llm"]:
        recorder.mark_not_run("real_native_tool_call", "LLM_BASE_URL/LLM_API_KEY/LLM_MODEL 未完整配置")
        recorder.mark_not_run("real_streaming_tool_call", "LLM_BASE_URL/LLM_API_KEY/LLM_MODEL 未完整配置")
        return
    try:
        validate_service_url(settings.llm_url, "LLM", settings.trusted_http_hosts)
    except ValueError:
        recorder.mark_not_run("real_native_tool_call", "LLM 服务地址未通过 TLS/内网 HTTP 安全校验")
        recorder.mark_not_run("real_streaming_tool_call", "LLM 服务地址未通过 TLS/内网 HTTP 安全校验")
        return
    searcher = FixtureSearcher()
    runtime = AgentRuntime(
        OpenAICompatibleToolModel(settings),
        default_registry(searcher),
        model_name=settings.llm_model,
        evidence_status="REAL",
        first_tool_name=TOOL_NAME,
    )

    def native_tool_call():
        result = runtime.run("请检索考试签字笔", scope())
        if result.status != "COMPLETED" or not result.tool_calls:
            raise AgentModelError(result.error_code or "REAL_NATIVE_TOOL_CALL_FAILED")
        return {
            "model": settings.llm_model,
            "toolCalls": len(result.tool_calls),
            "toolCallStatuses": [item.status for item in result.tool_calls],
            "continuedAnswer": bool(result.answer.strip()),
            "answerChars": len(result.answer),
            "usage": result.usage,
            "durationMs": result.duration_ms,
        }

    recorder.check("real_native_tool_call", native_tool_call)

    def streaming_tool_call():
        result = runtime.run_stream("请流式检索无糖茶", scope())
        if result.status != "COMPLETED" or not result.tool_calls:
            raise AgentModelError(result.error_code or "REAL_STREAMING_TOOL_CALL_FAILED")
        return {
            "model": settings.llm_model,
            "toolCalls": len(result.tool_calls),
            "toolCallStatuses": [item.status for item in result.tool_calls],
            "continuedAnswer": bool(result.answer.strip()),
            "answerChars": len(result.answer),
            "usage": result.usage,
            "durationMs": result.duration_ms,
        }

    recorder.check("real_streaming_tool_call", streaming_tool_call)


def run_real_embedding(recorder: EvidenceRecorder, settings: Settings) -> None:
    if not live_configured(settings)["embedding"]:
        recorder.mark_not_run("real_embedding_passage_query", "EMBEDDING_BASE_URL/EMBEDDING_API_KEY/EMBEDDING_MODEL 未完整配置")
        return
    try:
        validate_service_url(settings.embedding_url, "Embedding", settings.trusted_http_hosts)
    except ValueError:
        recorder.mark_not_run("real_embedding_passage_query", "Embedding 服务地址未通过 TLS/内网 HTTP 安全校验")
        return

    provider = Provider(settings)

    def passage_query_embedding():
        passage = provider.embed(["校园商城考试签字笔商品描述"], input_type="passage")
        query = provider.embed(["考试签字笔"], input_type="query")
        if len(passage) != 1 or len(query) != 1 or not passage[0] or len(passage[0]) != len(query[0]):
            raise AssertionError("真实 Embedding 返回数量或维度不一致")
        return {"model": settings.embedding_model, "dimensions": len(passage[0]), "passageCount": len(passage), "queryCount": len(query)}

    recorder.check("real_embedding_passage_query", passage_query_embedding)


def run_real_milvus(recorder: EvidenceRecorder, settings: Settings) -> None:
    configured = live_configured(settings)
    if not (configured["embedding"] and configured["milvus"]):
        recorder.mark_not_run("real_milvus_isolated_lifecycle", "EMBEDDING_* 与 MILVUS_* 未完整配置")
        recorder.mark_not_run("real_milvus_isolated_cleanup", "EMBEDDING_* 与 MILVUS_* 未完整配置，未创建隔离集合")
        recorder.mark_not_run("real_java_mysql_fact_revalidation", "本次未配置 Java Agent/商品事实复验入口")
        recorder.mark_not_run("real_end_to_end_agent_chain", "真实 Embedding/Milvus/Java 复验前置条件未满足")
        return

    collection = isolated_collection_name()
    assert_isolated_collection(collection)
    with tempfile.TemporaryDirectory(prefix="campus-agent-v1-1-") as directory:
        isolated = replace(settings, product_collection=collection, db_path=str(Path(directory) / "agent.db"))
        try:
            if not (isolated.embedding_url and isolated.embedding_key and isolated.embedding_model):
                raise ValueError("Embedding 配置不完整")
            if not (isolated.milvus_uri and isolated.milvus_token):
                raise ValueError("Milvus 配置不完整")
            if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", isolated.product_collection):
                raise ValueError("Milvus 商品集合名无效")
            validate_service_url(isolated.embedding_url, "Embedding", isolated.trusted_http_hosts)
            validate_service_url(isolated.milvus_uri, "Milvus", isolated.trusted_http_hosts, root_only=True)
        except Exception:  # noqa: BLE001 - 配置门禁只记录稳定状态，不输出异常正文
            recorder.mark_not_run("real_milvus_isolated_lifecycle", "Milvus 配置未通过服务端安全校验")
            recorder.mark_not_run("real_milvus_isolated_cleanup", "Milvus 未建立连接，无法执行隔离集合清理")
            recorder.mark_not_run("real_java_mysql_fact_revalidation", "本次未配置 Java Agent/商品事实复验入口")
            recorder.mark_not_run("real_end_to_end_agent_chain", "真实 Milvus 配置未通过安全校验")
            return
        index = ProductIndex(isolated, Provider(isolated))
        client = None
        created_by_run = False
        try:
            try:
                client = index._connect()
                if client.has_collection(collection_name=collection):
                    raise AssertionError("随机集合在本次运行前已经存在")
                created_by_run = True
            except Exception as error:  # noqa: BLE001 - 错误类型只记录稳定码
                recorder.add("real_milvus_isolated_lifecycle", "FAIL", errorCode=safe_exception_code(error))
                recorder.mark_not_run("real_java_mysql_fact_revalidation", "本次未配置 Java Agent/商品事实复验入口")
                recorder.mark_not_run("real_end_to_end_agent_chain", "真实 Milvus 连接失败，未进入 Java/MySQL 事实复验")
                return

            def lifecycle():
                first = index.upsert(FIXTURES)
                if first.get("indexed") != len(FIXTURES):
                    raise AssertionError("Milvus 商品写入数量不匹配")
                search = index.search("校园考试书写用品", 3)
                if not search.get("productIds"):
                    raise AssertionError("Milvus 真实检索没有返回候选")
                changed = [dict(FIXTURES[0], title="考试黑色签字笔")]
                if index.upsert(changed).get("indexed") != 1:
                    raise AssertionError("Milvus 增量更新未生效")
                deleted_id = FIXTURES[1]["productId"]
                if index.delete([deleted_id]).get("deleted") != 1:
                    raise AssertionError("Milvus 删除未生效")
                remaining = client.query(
                    collection_name=collection,
                    filter="id in " + json.dumps([deleted_id]),
                    output_fields=["id"],
                    limit=1,
                    consistency_level="Strong",
                )
                if remaining:
                    raise AssertionError("Milvus 删除后仍能查询到商品 ID")
                return {
                    "collection": collection,
                    "indexed": first["indexed"],
                    "searchCount": len(search["productIds"]),
                    "deletedIdAbsent": True,
                    "productionCollectionModified": False,
                }

            recorder.check("real_milvus_isolated_lifecycle", lifecycle)
        finally:
            def cleanup():
                if created_by_run and client is not None and client.has_collection(collection_name=collection):
                    client.drop_collection(collection_name=collection)
                if created_by_run and client is not None and client.has_collection(collection_name=collection):
                    raise AssertionError("Milvus 隔离集合清理失败")

            if client is None or not created_by_run:
                recorder.mark_not_run("real_milvus_isolated_cleanup", "本次运行未成功创建隔离集合，无法证明清理结果")
            else:
                recorder.check("real_milvus_isolated_cleanup", cleanup)
            if client is not None:
                client.close()

    recorder.mark_not_run("real_java_mysql_fact_revalidation", "M0/M1 未新增 Java Agent/商品事实 HTTP Port；需要后续 M2 受控 Gateway")
    recorder.mark_not_run("real_end_to_end_agent_chain", "真实 Milvus 候选尚未接入 Java/MySQL 事实复验")


def live_endpoint_safety(settings: Settings) -> dict[str, bool]:
    checks = {
        "llm": (settings.llm_url, "LLM", False),
        "embedding": (settings.embedding_url, "Embedding", False),
        "milvus": (settings.milvus_uri, "Milvus", True),
    }
    result = {}
    for name, (url, label, root_only) in checks.items():
        if not url:
            result[name] = True
            continue
        try:
            validate_service_url(url, label, settings.trusted_http_hosts, root_only=root_only)
        except ValueError:
            result[name] = False
        else:
            result[name] = True
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/testing/evidence/agent-v1.1.json")
    parser.add_argument("--require-live", action="store_true", help="真实必需检查未完成时返回非零")
    args = parser.parse_args()
    load_env(args.env_file)
    try:
        settings = Settings.from_env()
    except Exception:  # noqa: BLE001 - 解析错误只落稳定脱敏证据
        recorder = EvidenceRecorder(args.output, secrets.token_hex(12), "Agent v1.1 M0/M1", "NOT_RUN")
        recorder.data.update(
            {
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "configured": {},
                "configurationParseFailed": True,
                "productionProductCollectionModified": False,
                "javaMySqlTested": False,
                "businessWrites": False,
            }
        )
        recorder.add("real_configuration_parse", "FAIL", errorCode="INVALID_CONFIGURATION")
        recorder.data["summary"] = {"passed": 0, "failed": 1, "notRun": 0}
        recorder.write()
        print(json.dumps({"evidenceStatus": recorder.evidence_status, "summary": recorder.data["summary"]}, ensure_ascii=True))
        return 2 if args.require_live else 1
    configured = live_configured(settings)
    live_count = sum(configured[name] for name in ("llm", "embedding", "milvus"))
    configured_evidence_status = "REAL" if live_count == 3 else "DEGRADED" if live_count else "NOT_RUN"
    recorder = EvidenceRecorder(args.output, secrets.token_hex(12), "Agent v1.1 M0/M1", "NOT_RUN")
    recorder.data.update(
        {
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "configured": configured,
            "configuredEvidenceStatus": configured_evidence_status,
            "model": settings.llm_model or None,
            "embeddingModel": settings.embedding_model or None,
            "productionProductCollectionModified": False,
            "javaMySqlTested": False,
            "businessWrites": False,
        }
    )
    recorder.write()
    run_stub(recorder)
    endpoint_safety = live_endpoint_safety(settings)
    if all(endpoint_safety.values()):
        recorder.add("real_configuration_safety_gate", "PASS", validated=True)
    else:
        recorder.mark_not_run("real_configuration_safety_gate", "真实服务地址未全部通过 TLS/内网 HTTP 安全校验")
    run_real_model(recorder, settings)
    run_real_embedding(recorder, settings)
    run_real_milvus(recorder, settings)
    real_checks = [
        item
        for item in recorder.data["checks"]
        if item["name"].startswith("real_") and item["name"] != "real_configuration_safety_gate"
    ]
    if not real_checks or all(item["outcome"] == "NOT_RUN" for item in real_checks):
        recorder.evidence_status = "NOT_RUN"
    elif any(item["outcome"] != "PASS" for item in real_checks):
        recorder.evidence_status = "DEGRADED"
    else:
        recorder.evidence_status = "REAL"
    recorder.data["evidenceStatus"] = recorder.evidence_status
    recorder.data["summary"] = {
        "passed": sum(item["outcome"] == "PASS" for item in recorder.data["checks"]),
        "failed": sum(item["outcome"] == "FAIL" for item in recorder.data["checks"]),
        "notRun": sum(item["outcome"] == "NOT_RUN" for item in recorder.data["checks"]),
    }
    recorder.write()
    print(json.dumps({"evidenceStatus": recorder.evidence_status, "summary": recorder.data["summary"]}, ensure_ascii=True))
    if args.require_live:
        required_checks = {
            "real_configuration_safety_gate",
            "real_native_tool_call",
            "real_streaming_tool_call",
            "real_embedding_passage_query",
            "real_milvus_isolated_lifecycle",
            "real_milvus_isolated_cleanup",
            "real_java_mysql_fact_revalidation",
            "real_end_to_end_agent_chain",
        }
        checks = {item["name"]: item["outcome"] for item in recorder.data["checks"]}
        if not all(configured[name] for name in ("llm", "embedding", "milvus")) or any(checks.get(name) != "PASS" for name in required_checks):
            return 2
    return 1 if recorder.data["summary"]["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
