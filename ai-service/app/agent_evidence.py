"""Agent v1.1 运行证据和安全脱敏辅助。"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import secrets
from typing import Any, Callable

from .observability import logger


EVIDENCE_STATUSES = frozenset({"REAL", "STUB", "DEGRADED", "NOT_RUN"})
ISOLATED_COLLECTION_PATTERN = re.compile(r"^campus_agent_products_[a-f0-9]{16}$")
_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "api_key",
        "apikey",
        "token",
        "password",
        "prompt",
        "system",
        "messages",
        "request_body",
        "response_body",
        "exception_message",
        "stacktrace",
    }
)


def safe_exception_code(error: BaseException) -> str:
    status = getattr(getattr(error, "response", None), "status_code", None)
    if status == 429:
        return "UPSTREAM_429"
    if isinstance(status, int) and status >= 500:
        return "UPSTREAM_5XX"
    if isinstance(error, TimeoutError):
        return "UPSTREAM_TIMEOUT"
    if isinstance(error, (ConnectionError, OSError)):
        return "UPSTREAM_CONNECTION"
    return type(error).__name__.upper()


def isolated_collection_name() -> str:
    """生成不会与生产 ``campus_products_v1`` 冲突的测试集合名。"""

    return "campus_agent_products_" + secrets.token_hex(8)


def assert_isolated_collection(name: str, production_name: str = "campus_products_v1") -> None:
    if name == production_name or not ISOLATED_COLLECTION_PATTERN.fullmatch(name):
        raise ValueError("Milvus 集合必须是本次运行生成的隔离名称")


def safe_metadata(value: Any, key: str = "") -> Any:
    """递归保留诊断类型和计数，删除凭据、提示词及下游正文。"""

    if key.lower() in _SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): safe_metadata(v, str(k)) for k, v in value.items() if str(k).lower() not in _SENSITIVE_KEYS}
    if isinstance(value, (list, tuple)):
        return [safe_metadata(item, key) for item in value[:32]]
    if isinstance(value, (str, int, float, bool)) or value is None:
        if isinstance(value, str):
            return value[:200]
        return value
    return type(value).__name__


@dataclass
class EvidenceRecorder:
    path: Path
    run_id: str
    scope: str
    evidence_status: str
    data: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.evidence_status not in EVIDENCE_STATUSES:
            raise ValueError("非法 Agent 证据状态")
        self.data = {
            "runId": self.run_id,
            "scope": self.scope,
            "evidenceStatus": self.evidence_status,
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "checks": [],
            "productionProductCollectionModified": False,
            "javaMySqlTested": False,
            "businessWrites": False,
        }

    def add(self, name: str, outcome: str, **details: Any) -> dict[str, Any]:
        record = {"name": name, "outcome": outcome, **safe_metadata(details)}
        self.data["checks"].append(record)
        self.write()
        logger.info(
            "agent_evidence run_id=%s name=%s outcome=%s evidence_status=%s",
            self.run_id,
            name[:80],
            outcome[:32],
            self.evidence_status,
        )
        return record

    def check(self, name: str, function: Callable[[], dict[str, Any] | None]) -> dict[str, Any]:
        try:
            return self.add(name, "PASS", **(function() or {}))
        except Exception as error:  # noqa: BLE001 - 错误类型已脱敏记录
            return self.add(name, "FAIL", errorCode=safe_exception_code(error))

    def mark_not_run(self, name: str, reason: str) -> dict[str, Any]:
        return self.add(name, "NOT_RUN", reason=reason)

    def write(self) -> None:
        self.data["finishedAt"] = datetime.now(timezone.utc).isoformat()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
