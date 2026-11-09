from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("runtime_bridge_smoke", ROOT / "scripts/smoke-agent-v1-1-m2-runtime-bridge.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_loopback_rejects_credentials_and_public_host():
    assert MODULE.loopback("http://127.0.0.1:8100") == "http://127.0.0.1:8100"
    with pytest.raises(ValueError):
        MODULE.loopback("https://example.invalid")
    with pytest.raises(ValueError):
        MODULE.loopback("http://user:pass@127.0.0.1:8100")


def test_capability_digest_is_sha256_and_header_matches_contract():
    capability = "capability-secret"
    assert MODULE.capability_digest(capability) == __import__("hashlib").sha256(capability.encode()).hexdigest()


def test_signature_is_deterministic_and_changes_with_request():
    first = MODULE.signature("secret", "run", "req", 4102444800.0)
    assert first == MODULE.signature("secret", "run", "req", 4102444800.0)
    assert first != MODULE.signature("secret", "run", "other", 4102444800.0)
    assert len(first) == 64


def test_request_includes_capability_digest_header(monkeypatch):
    captured = {}

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, _limit):
            return b"{}"

    def fake_urlopen(req, timeout):
        captured.update(dict(req.header_items()))
        return Response()

    monkeypatch.setattr(MODULE.urllib.request, "urlopen", fake_urlopen)
    status, _ = MODULE.request("http://127.0.0.1:8100/internal/v1/agent/runtime/turn", {}, "service-key", "capability-secret", "run", "req", 4102444800.0)
    assert status == 200
    assert captured["X-agent-capability-digest"] == MODULE.capability_digest("capability-secret")


def test_run_without_service_key_is_not_run(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_KEY", raising=False)
    args = type("Args", (), {"runtime_url": "http://127.0.0.1:8100", "question": "找茶"})()
    result = MODULE.run(args)
    assert result["status"] == "NOT_RUN"
    assert result["evidenceStatus"] == "NOT_RUN"
    assert result["scope"] == "protocol_probe_only"
    assert result["realAgentIntegration"] == "NOT_RUN"
    assert "secret" not in json.dumps(result)


def test_java_process_test_reports_stub_without_claiming_real(monkeypatch):
    captured = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return MODULE.subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(MODULE.subprocess, "run", fake_run)
    monkeypatch.setattr(
        MODULE,
        "_java_process_test_report",
        lambda root, before: {"tests": 1, "errors": 0, "failures": 0, "skipped": 0, "durationSeconds": 1.2},
    )
    monkeypatch.setattr(
        MODULE,
        "_surefire_report",
        lambda root, class_name, before: {"tests": 8, "errors": 0, "failures": 0, "skipped": 0, "durationSeconds": 0.8},
    )
    args = type("Args", (), {"java_process_test": True, "maven": "mvnw.cmd", "python": ""})()

    result = MODULE.run(args)

    assert result["status"] == "PASS"
    assert result["evidenceStatus"] == "STUB"
    assert result["realAgentIntegration"] == "NOT_RUN"
    assert result["businessWrites"] is False
    assert "AgentRuntimeUvicornProcessIntegrationTest" in " ".join(captured["command"])
    assert captured["kwargs"]["env"]["AGENT_RUNTIME_PROCESS_TEST"] == "true"
    assert "provider secret body" not in json.dumps(result)


def test_java_process_test_failure_is_degraded_without_process_output(monkeypatch):
    def fake_run(command, **kwargs):
        return MODULE.subprocess.CompletedProcess(command, 1)

    monkeypatch.setattr(MODULE.subprocess, "run", fake_run)
    monkeypatch.setattr(MODULE, "_java_process_test_report", lambda root, before: None)
    monkeypatch.setattr(MODULE, "_surefire_report", lambda root, class_name, before: None)
    args = type("Args", (), {"java_process_test": True, "maven": "mvnw.cmd", "python": ""})()

    result = MODULE.run(args)

    assert result["status"] == "DEGRADED"
    assert result["evidenceStatus"] == "DEGRADED"
    assert result["realAgentIntegration"] == "NOT_RUN"
    assert "stdout" not in result and "stderr" not in result


def test_java_process_test_skipped_is_not_run(monkeypatch):
    monkeypatch.setattr(
        MODULE.subprocess,
        "run",
        lambda command, **kwargs: MODULE.subprocess.CompletedProcess(command, 0),
    )
    monkeypatch.setattr(
        MODULE,
        "_java_process_test_report",
        lambda root, before: {"tests": 1, "errors": 0, "failures": 0, "skipped": 1, "durationSeconds": 0.0},
    )
    monkeypatch.setattr(
        MODULE,
        "_surefire_report",
        lambda root, class_name, before: {"tests": 8, "errors": 0, "failures": 0, "skipped": 0, "durationSeconds": 0.0},
    )
    args = type("Args", (), {"java_process_test": True, "maven": "mvnw.cmd", "python": ""})()

    result = MODULE.run(args)

    assert result["status"] == "NOT_RUN"
    assert result["evidenceStatus"] == "NOT_RUN"
