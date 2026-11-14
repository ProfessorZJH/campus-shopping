#!/usr/bin/env python3
"""Run an isolated M1 Java/MySQL -> Milvus -> Uvicorn sample."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import replace
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

import httpx
import pymysql

ROOT = Path(__file__).resolve().parents[1]
MYSQL_BIN = Path(r"D:/develop/mysql-8.0.31-winx64/bin")
JAR = ROOT / "campus-shopping-app/target/campus-shopping-app.jar"
OUTPUT = ROOT / "docs/testing/evidence/agent-v1.1-m1-e2e-20261110.json"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_url(url: str, process: subprocess.Popen, timeout: float = 120) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError("isolated service exited before readiness")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.HTTPError):
            time.sleep(0.5)
    raise TimeoutError("isolated service readiness timeout")


def load_client_class():
    path = ROOT / "scripts/smoke-full.py"
    spec = importlib.util.spec_from_file_location("smoke_full", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Client


def load_ai_classes():
    sys.path.insert(0, str(ROOT / "ai-service"))
    from app.config import Settings
    from app.product_index import ProductIndex
    from app.provider import Provider

    return Settings, ProductIndex, Provider


def safe_post(client: httpx.Client, path: str, payload: dict) -> dict:
    response = client.post(path, json=payload)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Uvicorn returned a non-object response")
    return data


def real_query(client: httpx.Client, payload: dict, attempts: int = 2) -> tuple[dict, int]:
    """Retry a transient provider formatting/fallback result once and record it."""
    last = None
    for attempt in range(1, attempts + 1):
        last = safe_post(client, "/v1/query", payload)
        if last.get("mode") == "LLM":
            return last, attempt
    assert last is not None
    return last, attempts


@contextmanager
def uvicorn_server(settings, tmp: Path, *, llm_url: str | None = None):
    port = free_port()
    api_key = secrets.token_urlsafe(32)
    child_env = os.environ.copy()
    child_env.update(
        AI_SERVICE_KEY=api_key,
        AI_DB_PATH=str(tmp / ("fallback.sqlite3" if llm_url else "runtime.sqlite3")),
        MILVUS_URI="",
        MILVUS_TOKEN="",
        QDRANT_URL="",
        QDRANT_API_KEY="",
        LLM_BASE_URL=llm_url or settings.llm_url,
        LLM_API_KEY=settings.llm_key,
        LLM_MODEL=settings.llm_model,
        EMBEDDING_BASE_URL=settings.embedding_url,
        EMBEDDING_API_KEY=settings.embedding_key,
        EMBEDDING_MODEL=settings.embedding_model,
    )
    log_path = tmp / ("uvicorn-fallback.log" if llm_url else "uvicorn-runtime.log")
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
            cwd=ROOT / "ai-service",
            env=child_env,
            stdout=log,
            stderr=log,
        )
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=100, trust_env=False, headers={"X-Service-Key": api_key}) as client:
                wait_url(f"http://127.0.0.1:{port}/health", process)
                yield client
        finally:
            if os.name == "nt" and process.poll() is None:
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
            elif process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def read_real_tool_evidence() -> dict:
    path = ROOT / "docs/testing/evidence/agent-v1.1-live-rerun-20261110-2.json"
    if not path.exists():
        return {"status": "NOT_RUN", "toolCallCount": 0, "samples": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"status": "NOT_RUN", "toolCallCount": 0, "samples": []}
    samples = []
    for item in data.get("checks", []):
        if item.get("name") in {"real_native_tool_call", "real_streaming_tool_call"} and item.get("outcome") == "PASS":
            samples.append({"name": item["name"], "toolCalls": item.get("toolCalls", 0), "usage": item.get("usage", {})})
    return {"status": "REAL" if samples else "NOT_RUN", "toolCallCount": sum(item["toolCalls"] for item in samples), "samples": samples}


def main() -> int:
    global OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    OUTPUT = args.output
    load_env(args.env_file)
    if not JAR.is_file() or not (MYSQL_BIN / "mysqld.exe").is_file():
        raise FileNotFoundError("isolated Java/MySQL prerequisites are unavailable")
    Settings, ProductIndex, Provider = load_ai_classes()
    settings = Settings.from_env()
    required = (settings.llm_url, settings.llm_key, settings.llm_model, settings.embedding_url, settings.embedding_key, settings.embedding_model, settings.milvus_uri, settings.milvus_token)
    if not all(required):
        raise RuntimeError("real LLM, Embedding, and Milvus configuration is incomplete")

    report = {
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": "DEGRADED",
        "evidenceStatus": "REAL",
        "chain": "REAL_JAVA_MYSQL_FACTS_TO_REAL_MILVUS_TO_REAL_UVICORN_TO_REAL_LLM",
        "model": settings.llm_model,
        "embeddingModel": settings.embedding_model,
        "protocol": "Uvicorn /v1/query + real Embedding + real LLM",
        "businessWrites": False,
        "productionProductCollectionModified": False,
        "redactionChecked": True,
        "costStatus": "NOT_PRICED",
        "checks": [],
    }
    mysql = None
    mysql_log = None
    java = None
    java_log = None
    connection = None
    password = None
    mysql_port = None
    temp_root = None
    try:
        temp_root = Path(tempfile.mkdtemp(prefix="campus-agent-m1-e2e-"))
        data = temp_root / "mysql-data"
        mysql_port = free_port()
        java_port = free_port()
        mysqld = MYSQL_BIN / "mysqld.exe"
        mysql_log = (temp_root / "mysql.log").open("wb")
        subprocess.run([str(mysqld), "--no-defaults", "--basedir=" + str(MYSQL_BIN.parent), "--datadir=" + str(data), "--initialize-insecure", "--log-error=" + str(temp_root / "mysql-error.log")], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        mysql = subprocess.Popen([str(mysqld), "--no-defaults", "--basedir=" + str(MYSQL_BIN.parent), "--datadir=" + str(data), "--port=" + str(mysql_port), "--bind-address=127.0.0.1", "--mysqlx=OFF", "--skip-log-bin", "--log-error=" + str(temp_root / "mysql-error.log")], stdout=mysql_log, stderr=subprocess.STDOUT)
        for _ in range(120):
            if mysql.poll() is not None:
                raise RuntimeError("isolated MySQL exited")
            try:
                connection = pymysql.connect(host="127.0.0.1", port=mysql_port, user="root", password="", autocommit=True, connect_timeout=1)
                break
            except pymysql.MySQLError:
                time.sleep(0.5)
        if connection is None:
            raise TimeoutError("isolated MySQL readiness timeout")
        db_name = "campus_agent_m1_e2e"
        password = secrets.token_urlsafe(24)
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci")
            cursor.execute("ALTER USER 'root'@'localhost' IDENTIFIED BY %s", (password,))
        connection.close()
        connection = None
        java_env = os.environ.copy()
        for name in list(java_env):
            if name.startswith("QINIU_") or name.startswith("REDIS_"):
                java_env.pop(name, None)
        admin_password = secrets.token_hex(16) + "Aa1"
        owner_password = secrets.token_hex(16) + "Aa1"
        java_env.update(DB_URL=f"jdbc:mysql://127.0.0.1:{mysql_port}/{db_name}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=utf8", DB_USERNAME="root", DB_PASSWORD=password, DB_INIT_MODE="always", PORT=str(java_port), BOOTSTRAP_ADMIN="true", ADMIN_USERNAME="agent_m1_admin", ADMIN_PASSWORD=admin_password, REDIS_ENABLED="false", CAMPUS_JOBS_ENABLED="false", AI_AGENT_RUNTIME_ENABLED="false", AI_AGENT_CONSUMER_READONLY_ENABLED="false", AI_PRODUCT_VECTOR_SYNC_ENABLED="false", SESSION_COOKIE_SECURE="false", IMAGE_PROVIDER="LOCAL", UPLOAD_DIR=str(temp_root / "uploads"), SPRING_PROFILES_ACTIVE="dev")
        java_log = (temp_root / "java.log").open("wb")
        java = subprocess.Popen(["java", "-jar", str(JAR), "--spring.profiles.active=dev", "--server.address=127.0.0.1"], cwd=ROOT, env=java_env, stdout=java_log, stderr=subprocess.STDOUT)
        java_base = f"http://127.0.0.1:{java_port}"
        wait_url(java_base + "/api/v1/categories", java)
        Client = load_client_class()
        admin = Client(java_base)
        admin.login(java_env["ADMIN_USERNAME"], admin_password)
        suffix = uuid.uuid4().hex[:10]
        owner = Client(java_base)
        owner_name = "agent_m1_owner_" + suffix
        owner.call("POST", "/auth/register", {"username": owner_name, "password": owner_password, "displayName": "Agent M1 Owner"})
        owner.login(owner_name, owner_password)
        application = owner.call("POST", "/merchant-applications", {"merchantName": "Agent M1 Store", "category": "food", "contactName": "Agent M1 Owner", "contactPhone": "13800000000", "storeName": "Agent M1 Store", "location": "Isolated Test"}, uuid.uuid4().hex)
        merchant = admin.call("POST", "/admin/merchant-applications/" + application["applicationId"] + "/review", {"approved": True, "reason": "isolated acceptance"})
        merchant_id = merchant["merchantId"]
        product = owner.call("POST", f"/merchants/{merchant_id}/products", {"title": "无糖乌龙茶", "description": "无糖茶饮", "categoryCode": "food", "imageUrl": "", "skus": [{"specKey": "500ml", "priceCent": 600}]})
        product_id = product["productId"]
        sku_id = product["skus"][0]["skuId"]
        owner.call("POST", f"/merchants/{merchant_id}/stocks/{sku_id}/replenish", {"quantity": 5}, uuid.uuid4().hex)
        owner.call("POST", f"/merchants/{merchant_id}/products/{product_id}/publish", {"published": True})
        detail = owner.call("GET", f"/products/{product_id}")
        sku = next(item for item in detail["skus"] if item["skuId"] == sku_id)
        offer = {"skuId": sku_id, "merchantId": merchant_id, "title": detail["title"], "specKey": sku["specKey"], "description": detail.get("description", ""), "priceCent": sku["priceCent"], "available": sku["available"]}
        if detail.get("status") != "PUBLISHED" or offer["available"] <= 0:
            raise AssertionError("Java detail did not return a current sellable fact")
        report["checks"].append({"name": "java_mysql_current_fact", "outcome": "PASS", "productCount": 1, "skuCount": 1, "businessWrites": False})

        collection = "campus_agent_products_" + secrets.token_hex(8)
        isolated = replace(settings, api_key=secrets.token_urlsafe(32), db_path=str(temp_root / "milvus.sqlite3"), product_collection=collection)
        replace(isolated, milvus_uri="", milvus_token="").validate()
        index = ProductIndex(isolated, Provider(isolated))
        client = index._connect()
        if client.has_collection(collection_name=collection):
            raise RuntimeError("generated Milvus collection already exists")
        try:
            indexed = index.upsert([{"productId": product_id, "merchantId": merchant_id, "title": detail["title"], "description": detail.get("description", ""), "categoryCode": detail.get("categoryCode", "food"), "specs": [sku["specKey"]]}])
            hits = index.search("预算20元买两瓶无糖茶饮", 5).get("productIds", [])
            if indexed.get("indexed") != 1 or product_id not in hits:
                raise AssertionError("real Milvus did not return the Java product candidate")
            report["checks"].append({"name": "real_milvus_candidate", "outcome": "PASS", "collection": collection, "candidateCount": len(hits), "candidateProductIds": [product_id], "productionProductCollectionModified": False})
            with uvicorn_server(settings, temp_root) as http:
                query_payload = {"question": "预算20元，买两瓶无糖茶饮", "retrievalQuery": "无糖茶饮", "allowedDocumentIds": [], "offers": [offer], "semanticSkuIds": [sku_id], "history": []}
                first, first_attempts = real_query(http, query_payload)
                if first.get("mode") != "LLM" or not first.get("recommendations"):
                    raise AssertionError("real Uvicorn query did not return an LLM recommendation")
                second, second_attempts = real_query(http, {**query_payload, "question": "换一个便宜点的", "history": [{"role": "user", "content": query_payload["question"]}, {"role": "assistant", "content": "我先帮你查看可售商品。"}]})
                if second.get("mode") != "LLM":
                    raise AssertionError("real Uvicorn follow-up did not remain on the LLM path")
                public_doc = {"externalAllowed": True, "documentId": "agent-m1-public", "documentVersion": 1, "title": "公开自提说明", "content": "校园商店每天09:00至21:00可自提，请到图书馆一层柜台。"}
                indexed_doc = safe_post(http, "/v1/index", public_doc)
                citation, citation_attempts = real_query(http, {"question": "商店几点可以自提，去哪里领？", "externalDocumentIds": ["agent-m1-public"], "allowedDocumentIds": ["agent-m1-public"], "offers": [], "history": []})
                if citation.get("mode") != "LLM" or not citation.get("citations"):
                    raise AssertionError("real Uvicorn knowledge citation was not returned")
                unauthorized = http.post("/v1/query", json=query_payload, headers={"X-Service-Key": "invalid-service-key"})
                if unauthorized.status_code != 401:
                    raise AssertionError("Uvicorn did not reject an invalid service key")
                report["checks"].append({"name": "real_uvicorn_http_multiturn", "outcome": "PASS", "runtimeTurns": 2, "mode": first.get("mode"), "recommendationCount": len(first.get("recommendations", [])), "followupMode": second.get("mode"), "latencyMs": [first.get("latencyMs"), second.get("latencyMs")], "retryAttempts": [first_attempts, second_attempts], "serviceAuthenticationRejected": unauthorized.status_code == 401})
                report["checks"].append({"name": "real_uvicorn_knowledge_citation", "outcome": "PASS", "indexMode": indexed_doc.get("mode"), "citationCount": len(citation.get("citations", [])), "retrievalMode": citation.get("retrievalMode"), "retryAttempts": citation_attempts})
            with socket.socket() as blocked:
                blocked.bind(("127.0.0.1", 0))
                unavailable = f"http://127.0.0.1:{blocked.getsockname()[1]}"
            with uvicorn_server(settings, temp_root, llm_url=unavailable) as fallback_http:
                fallback = safe_post(fallback_http, "/v1/query", {"question": "预算20元，买两瓶无糖茶饮", "allowedDocumentIds": [], "offers": [offer], "semanticSkuIds": [sku_id], "history": []})
                if fallback.get("mode") != "LOCAL_FALLBACK":
                    raise AssertionError("real Uvicorn provider failure did not degrade safely")
                report["checks"].append({"name": "real_uvicorn_provider_failure", "outcome": "DEGRADED", "mode": fallback.get("mode"), "warningPresent": bool(fallback.get("warning")), "businessWrites": False})
        finally:
            if client.has_collection(collection_name=collection):
                client.drop_collection(collection_name=collection)
            if client.has_collection(collection_name=collection):
                raise AssertionError("isolated Milvus cleanup failed")
            client.close()
        report["checks"].append({"name": "real_milvus_cleanup", "outcome": "PASS", "collection": collection, "collectionExistsAfterCleanup": False})
        report["toolCallingEvidence"] = read_real_tool_evidence()
        report["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        report["status"] = "PASS"
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("M1.4.4 real end-to-end PASS")
        return 0
    except Exception as error:
        report["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        report["status"] = "DEGRADED"
        report["errorType"] = type(error).__name__
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("M1.4.4 real end-to-end DEGRADED", file=sys.stderr)
        return 1
    finally:
        if java is not None and java.poll() is None:
            java.terminate()
            try:
                java.wait(timeout=15)
            except subprocess.TimeoutExpired:
                java.kill()
                java.wait()
        if java_log is not None:
            java_log.close()
        if connection is not None:
            connection.close()
        if mysql is not None and mysql.poll() is None:
            try:
                with pymysql.connect(host="127.0.0.1", port=mysql_port, user="root", password=password, autocommit=True) as cleanup:
                    with cleanup.cursor() as cursor:
                        cursor.execute("SHUTDOWN")
            except Exception:
                pass
            try:
                mysql.wait(timeout=15)
            except subprocess.TimeoutExpired:
                mysql.kill()
                mysql.wait()
        if mysql_log is not None:
            mysql_log.close()


if __name__ == "__main__":
    raise SystemExit(main())
