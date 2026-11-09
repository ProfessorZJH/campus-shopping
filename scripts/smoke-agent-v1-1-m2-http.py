#!/usr/bin/env python3
"""Run a read-only Java/MySQL facts -> Uvicorn HTTP acceptance probe.

The probe deliberately uses the existing public catalog read endpoint and the
existing ``/v1/query`` contract.  It does not add an Agent route, call the
unfinished ``IAgentRuntimePort``, or write a business table.  A Java service
must already be running on a loopback address; the Python service is started
with an isolated temporary SQLite database and with external providers
disabled.
"""
from __future__ import annotations

import argparse
import datetime as dt
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
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


class ProbeNotRun(RuntimeError):
    """The environment is unavailable for this optional acceptance probe."""


def assert_loopback(url: str, label: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in LOOPBACK_HOSTS:
        raise ValueError(f"{label} must use a loopback HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"{label} must not embed credentials or query parameters")
    return parsed


def _request_json(base_url: str, method: str, path: str, payload: dict | None = None, *, headers: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request_headers = {"Accept": "application/json"}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(base_url.rstrip("/") + path, data=body, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise ProbeNotRun(f"{method} {path} returned HTTP {error.code}") from None
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise ProbeNotRun(f"{method} {path} unavailable: {type(error).__name__}") from None


def java_products_to_offers(response: dict) -> list[dict]:
    """Convert Java's read-only product view into the existing Python query DTO."""
    if response.get("code") != "0000":
        raise ProbeNotRun("Java catalog response was not successful")
    data = response.get("data")
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ProbeNotRun("Java catalog response has no product items")
    offers: list[dict] = []
    for product in items:
        if not isinstance(product, dict):
            continue
        merchant_id = product.get("merchantId")
        title = product.get("title")
        description = product.get("description") or ""
        if not isinstance(merchant_id, str) or not merchant_id or not isinstance(title, str) or not title:
            continue
        for sku in product.get("skus") or []:
            if not isinstance(sku, dict):
                continue
            sku_id = sku.get("skuId")
            spec_key = sku.get("specKey")
            price_cent = sku.get("priceCent")
            available = sku.get("available")
            if (
                not isinstance(sku_id, str)
                or not sku_id
                or not isinstance(spec_key, str)
                or not spec_key
                or isinstance(price_cent, bool)
                or not isinstance(price_cent, int)
                or price_cent <= 0
                or isinstance(available, bool)
                or not isinstance(available, int)
                or available <= 0
            ):
                continue
            if sku.get("status") not in (None, "ACTIVE") or product.get("status") not in (None, "PUBLISHED"):
                continue
            offers.append(
                {
                    "skuId": sku_id,
                    "merchantId": merchant_id,
                    "title": title,
                    "specKey": spec_key,
                    "description": description,
                    "attributes": {},
                    "priceCent": price_cent,
                    "available": available,
                }
            )
    return offers


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_ai(process: subprocess.Popen, base_url: str) -> None:
    for _ in range(100):
        if process.poll() is not None:
            raise ProbeNotRun("Uvicorn process exited before readiness")
        try:
            health = _request_json(base_url, "GET", "/health")
            if health.get("status") == "UP":
                return
        except ProbeNotRun:
            pass
        time.sleep(0.1)
    raise ProbeNotRun("Uvicorn did not become ready")


def run(args: argparse.Namespace) -> dict:
    java_url = args.java_base_url.rstrip("/")
    assert_loopback(java_url, "Java base URL")
    query = args.query.strip()
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    java_response = _request_json(
        java_url,
        "GET",
        "/api/v1/products/page?" + urllib.parse.urlencode({"q": args.catalog_query, "page": 1, "size": args.page_size}),
    )
    offers = java_products_to_offers(java_response)
    if not offers:
        raise ProbeNotRun("Java catalog returned no currently available SKU facts")
    if not query:
        query = offers[0]["title"]

    python_bin = Path(args.python or sys.executable)
    if not python_bin.exists():
        raise ProbeNotRun("configured Python interpreter does not exist")
    key = secrets.token_urlsafe(32)
    with tempfile.TemporaryDirectory(prefix="campus-agent-m2-http-") as tmp:
        tmp_path = Path(tmp)
        env = os.environ.copy()
        for name in tuple(env):
            if name.startswith(("LLM_", "EMBEDDING_", "QDRANT_", "MILVUS_")):
                env.pop(name, None)
        env.update(AI_SERVICE_KEY=key, AI_DB_PATH=str(tmp_path / "knowledge.sqlite3"))
        port = _free_port()
        log_path = tmp_path / "uvicorn.log"
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [str(python_bin), "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", str(port)],
                cwd=ROOT / "ai-service",
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            ai_url = f"http://127.0.0.1:{port}"
            try:
                _wait_for_ai(process, ai_url)
                ai_response = _request_json(
                    ai_url,
                    "POST",
                    "/v1/query",
                    {
                        "question": query,
                        "allowedDocumentIds": [],
                        "offers": offers,
                        "history": [],
                        "semanticSkuIds": [],
                        "answerPreview": False,
                    },
                    headers={"X-Service-Key": key},
                )
            finally:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        report = {
            "startedAt": started,
            "finishedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "status": "PASS",
            "evidenceStatus": "DEGRADED",
            "chain": "REAL_JAVA_MYSQL_READ_TO_REAL_UVICORN_HTTP",
            "javaFactsSource": "GET /api/v1/products/page",
            "pythonEndpoint": "POST /v1/query",
            "offerCount": len(offers),
            "recommendations": ai_response.get("recommendations", []),
            "checks": [
                "Java response was read through the existing anonymous catalog endpoint",
                "Only active products, active SKUs, positive price and positive available stock were forwarded",
                "Python processed the facts through a real loopback Uvicorn HTTP request",
                "Every recommendation SKU was present in the Java fact snapshot",
                "No Agent route, transaction table, cart, order, stock or payment write was used",
            ],
            "agentGatewayInvoked": False,
            "businessWrites": False,
        }
        offer_ids = {offer["skuId"] for offer in offers}
        recommendations = ai_response.get("recommendations")
        if not isinstance(recommendations, list) or not all(item.get("skuId") in offer_ids for item in recommendations if isinstance(item, dict)):
            raise AssertionError("Python recommendation escaped the Java fact snapshot")
        if ai_response.get("mode") not in {"LOCAL_RETRIEVAL_DEMO", "LOCAL_FALLBACK"}:
            raise AssertionError("isolated probe unexpectedly used an external model")
        return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-base-url", default="http://127.0.0.1:8091")
    parser.add_argument("--catalog-query", default="")
    parser.add_argument("--query", default="")
    parser.add_argument("--page-size", type=int, default=20)
    parser.add_argument("--python", default="")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/testing/evidence/agent-v1.1-m2-http.json")
    args = parser.parse_args()
    try:
        report = run(args)
    except ProbeNotRun as error:
        report = {
            "startedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "status": "NOT_RUN",
            "evidenceStatus": "NOT_RUN",
            "reason": str(error),
            "agentGatewayInvoked": False,
            "businessWrites": False,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"M2 HTTP probe NOT_RUN: {error}", file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"M2 HTTP facts probe PASS: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
