#!/usr/bin/env python3
"""Probe the internal Java-to-Python Runtime Bridge over loopback HTTP.

This harness never treats a missing Java/Python service or a stub model as a
successful external acceptance. It records REAL, STUB, DEGRADED, or NOT_RUN
and keeps credentials and downstream response bodies out of evidence.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def loopback(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("runtime URL must be a loopback HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("runtime URL must not embed credentials or query parameters")
    return url.rstrip("/")


def load_env_file(path: Path | None) -> None:
    if path is None:
        return
    if not path.exists():
        raise ValueError("configured env file does not exist")
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            os.environ.setdefault(name.strip(), value.strip())


def signature(key: str, run_id: str, request_id: str, expires: float) -> str:
    canonical = f"{run_id}|{request_id}|{expires:.6f}".encode("utf-8")
    return hmac.new(key.encode("utf-8"), canonical, hashlib.sha256).hexdigest()


def capability_digest(capability: str) -> str:
    return hashlib.sha256(capability.encode("utf-8")).hexdigest()


def request(url: str, payload: dict, key: str, capability: str, run_id: str, request_id: str, expires: float) -> tuple[int, dict | None]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Service-Key": key,
        "X-Agent-Capability": capability,
        "X-Agent-Capability-Digest": capability_digest(capability),
        "X-Agent-Capability-Signature": signature(key, run_id, request_id, expires),
        "X-Request-ID": request_id,
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                return response.status, None
            parsed = json.loads(raw.decode("utf-8"))
            return response.status, parsed if isinstance(parsed, dict) else None
    except urllib.error.HTTPError as error:
        try:
            raw = error.read(64_000)
            parsed = json.loads(raw.decode("utf-8"))
            return error.code, parsed if isinstance(parsed, dict) else None
        except (OSError, ValueError, json.JSONDecodeError):
            return error.code, None
    except (OSError, ValueError, json.JSONDecodeError):
        return 0, None


def run(args: argparse.Namespace) -> dict:
    endpoint = loopback(args.runtime_url) + "/internal/v1/agent/runtime/turn"
    key = os.getenv("AI_SERVICE_KEY", "")
    if len(key) < 24:
        return {
            "status": "NOT_RUN",
            "evidenceStatus": "NOT_RUN",
            "reason": "AI_SERVICE_KEY is not configured",
            "checks": [
                "loopback URL validation",
                "capability SHA-256 digest header contract",
                "HMAC request signature helper",
            ],
            "scope": "protocol_probe_only",
            "realAgentIntegration": "NOT_RUN",
        }
    now = time.time()
    expires = now + 600
    run_id = "harness-" + secrets.token_hex(8)
    request_id = "req-" + secrets.token_hex(8)
    capability = secrets.token_urlsafe(24)
    payload = {
        "protocolVersion": "1.0",
        "runId": run_id,
        "requestId": request_id,
        "phase": "START",
        "question": args.question,
        "scope": {
            "userId": "harness-user",
            "identityKind": "consumer",
            "authorizedMerchantIds": [],
            "permissions": ["catalog.product.search"],
            "conversationId": "harness-conversation",
            "turnToken": "harness-turn-token",
            "turnExpiresAt": expires,
        },
        "allowedTools": [{"name": "search_products", "description": "read-only", "parameters": {"type": "object"}, "readOnly": True}],
        "toolResults": [],
    }
    status, response = request(endpoint, payload, key, capability, run_id, request_id, expires)
    if status == 0:
        return {
            "status": "NOT_RUN",
            "evidenceStatus": "NOT_RUN",
            "reason": "Runtime endpoint unavailable",
            "endpoint": endpoint,
            "checks": ["loopback URL validation", "capability SHA-256 digest header contract", "HMAC request signature helper"],
            "scope": "protocol_probe_only",
            "realAgentIntegration": "NOT_RUN",
        }
    if status in {401, 403}:
        return {"status": "DEGRADED", "evidenceStatus": "DEGRADED", "reason": "Runtime authentication rejected", "httpStatus": status, "endpoint": endpoint, "checks": ["service authentication boundary responded"]}
    if status >= 500:
        return {"status": "DEGRADED", "evidenceStatus": "DEGRADED", "reason": "Runtime returned server failure", "httpStatus": status, "endpoint": endpoint, "checks": ["failure was mapped without downstream body"]}
    if status != 200 or not isinstance(response, dict):
        return {"status": "DEGRADED", "evidenceStatus": "DEGRADED", "reason": "Runtime returned invalid protocol response", "httpStatus": status, "endpoint": endpoint, "checks": []}
    protocol = response.get("protocolVersion")
    state = response.get("status")
    if protocol != "1.0" or state not in {"TOOL_CALLS", "FINAL", "FAILED"} or response.get("runId") != run_id or response.get("requestId") != request_id:
        return {"status": "DEGRADED", "evidenceStatus": "DEGRADED", "reason": "Runtime response failed protocol validation", "endpoint": endpoint, "httpStatus": status, "checks": []}
    return {
        "status": "PASS",
        "evidenceStatus": "STUB" if response.get("evidenceStatus") == "STUB" else "REAL",
        "endpoint": endpoint,
        "protocolVersion": protocol,
        "runtimeStatus": state,
        "toolCallCount": len(response.get("toolCalls") or []),
        "durationMs": response.get("durationMs") if isinstance(response.get("durationMs"), int) else None,
        "businessWrites": False,
        "checks": ["double authentication accepted", "run and request correlation preserved", "response status is versioned", "no business write endpoint was called"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-url", default="http://127.0.0.1:8100")
    parser.add_argument("--env-file", type=Path, default=None, help="optional private env file; values are never printed")
    parser.add_argument("--question", default="找可售的茶")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/testing/evidence/agent-v1.1-m2-runtime-bridge.json")
    args = parser.parse_args()
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        load_env_file(args.env_file)
        report = run(args)
    except ValueError as error:
        report = {"status": "NOT_RUN", "evidenceStatus": "NOT_RUN", "reason": str(error), "checks": []}
    report["startedAt"] = started
    report["finishedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Runtime bridge probe {report['status']}: {args.output}")
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
