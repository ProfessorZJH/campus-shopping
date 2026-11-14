"""Versioned consumer read-only tool contracts.

This module deliberately stays outside :func:`default_registry` and
``RuntimeBridge._tools`` until the Java gateway and Python schemas are
released together.  Tests and a future loopback adapter can opt in by
calling :func:`consumer_readonly_registry` with ``enabled=True``.
"""
from __future__ import annotations

from datetime import datetime
import math
from typing import Any, Callable, Literal, Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .agent_contract import AgentScope, ToolRegistry, ToolSpec


KNOWLEDGE_QA_NAME = "knowledge_qa"
KNOWLEDGE_QA_VERSION = "1.0"
GET_MY_ORDERS_NAME = "get_my_orders"
GET_MY_ORDERS_VERSION = "1.0"

OrderState = Literal["", "PENDING_PAYMENT", "PAID", "COMPLETED", "CANCELED", "REFUNDED"]


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class KnowledgeQaArguments(_StrictModel):
    """Arguments sent by a model; Java supplies actor and readable scope."""

    question: str = Field(min_length=1, max_length=1000)

    @field_validator("question", mode="before")
    @classmethod
    def normalize_question(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("question required")
        return value


class KnowledgeCitation(_StrictModel):
    documentId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    snippet: str = Field(min_length=1, max_length=500)
    score: float = Field(ge=0)

    @field_validator("documentId", "title", "snippet", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("score")
    @classmethod
    def finite_score(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("score must be finite")
        return value


class KnowledgeQaResult(_StrictModel):
    tool: Literal[KNOWLEDGE_QA_NAME]
    version: Literal[KNOWLEDGE_QA_VERSION]
    readOnly: Literal[True]
    query: str = Field(min_length=1, max_length=1000)
    answer: str = Field(default="", max_length=8000)
    answerMode: str = Field(min_length=1, max_length=32)
    retrievalMode: str = Field(min_length=1, max_length=32)
    warning: str | None = Field(default=None, max_length=500)
    citations: list[KnowledgeCitation] = Field(default_factory=list, max_length=20)
    durationMs: int = Field(ge=0, le=120_000)

    @field_validator("query", mode="before")
    @classmethod
    def normalize_query(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("query required")
        return value

    @field_validator("answer", "answerMode", "retrievalMode", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("warning", mode="before")
    @classmethod
    def normalize_warning(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class GetMyOrdersArguments(_StrictModel):
    """Bounded own-order filter; buyer and merchant scope are never arguments."""

    state: OrderState = ""
    page: int = Field(ge=1, le=10_000)
    size: int = Field(ge=1, le=20)

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: Any) -> Any:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return value


class OrderItemSummary(_StrictModel):
    skuId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    specKey: str = Field(min_length=1, max_length=200)
    unitPriceCent: int = Field(ge=0, le=100_000_000)
    quantity: int = Field(ge=1, le=99)

    @field_validator("skuId", "title", "specKey", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class OrderSummary(_StrictModel):
    orderId: str = Field(min_length=1, max_length=64)
    status: Literal["PENDING_PAYMENT", "PAID", "COMPLETED", "CANCELED", "REFUNDED"]
    totalCent: int = Field(ge=0, le=2_000_000_000)
    createdAt: str = Field(min_length=1, max_length=64)
    merchantName: str = Field(min_length=1, max_length=200)
    items: list[OrderItemSummary] = Field(min_length=1, max_length=20)

    @field_validator("orderId", "merchantName", "status", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("createdAt")
    @classmethod
    def iso_timestamp(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("createdAt required")
        candidate = normalized[:-1] + "+00:00" if normalized.endswith("Z") else normalized
        try:
            datetime.fromisoformat(candidate)
        except ValueError:
            raise ValueError("createdAt must be ISO-8601") from None
        return normalized


class GetMyOrdersResult(_StrictModel):
    tool: Literal[GET_MY_ORDERS_NAME]
    version: Literal[GET_MY_ORDERS_VERSION]
    readOnly: Literal[True]
    state: OrderState
    page: int = Field(ge=1, le=10_000)
    size: int = Field(ge=1, le=20)
    total: int = Field(ge=0)
    items: list[OrderSummary] = Field(default_factory=list, max_length=20)

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: Any) -> Any:
        if value is None:
            return ""
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def bounded_page(self) -> "GetMyOrdersResult":
        if len(self.items) > self.size:
            raise ValueError("items exceed page size")
        return self


KnowledgeQaHandler = Callable[[KnowledgeQaArguments, AgentScope], Mapping[str, Any]]
GetMyOrdersHandler = Callable[[GetMyOrdersArguments, AgentScope], Mapping[str, Any]]


def knowledge_qa_tool(handler: KnowledgeQaHandler) -> ToolSpec:
    """Build the opt-in read-only ``knowledge_qa`` ToolSpec."""

    return ToolSpec(
        name=KNOWLEDGE_QA_NAME,
        version=KNOWLEDGE_QA_VERSION,
        description="Answer a consumer knowledge question from Java-authorized readable scope.",
        input_model=KnowledgeQaArguments,
        output_model=KnowledgeQaResult,
        handler=handler,
    )


def get_my_orders_tool(handler: GetMyOrdersHandler) -> ToolSpec:
    """Build the opt-in read-only ``get_my_orders`` ToolSpec."""

    return ToolSpec(
        name=GET_MY_ORDERS_NAME,
        version=GET_MY_ORDERS_VERSION,
        description="Read the active consumer's own order summaries with bounded filters.",
        input_model=GetMyOrdersArguments,
        output_model=GetMyOrdersResult,
        handler=handler,
    )


def consumer_readonly_registry(
    knowledge_handler: KnowledgeQaHandler | None = None,
    orders_handler: GetMyOrdersHandler | None = None,
    *,
    enabled: bool = False,
) -> ToolRegistry:
    """Return an opt-in registry without changing the production whitelist.

    ``enabled=False`` is the safe default and returns an empty registry.  When
    enabled, both handlers are required so a Java/Python rollout cannot expose
    only half of the consumer capability.
    """

    if not enabled:
        return ToolRegistry(())
    if not callable(knowledge_handler) or not callable(orders_handler):
        raise ValueError("both consumer read-only handlers are required when enabled")
    return ToolRegistry((knowledge_qa_tool(knowledge_handler), get_my_orders_tool(orders_handler)))


# Explicitly named alias for callers that prefer a feature-gate verb.
enable_consumer_readonly_registry = consumer_readonly_registry


__all__ = [
    "GET_MY_ORDERS_NAME",
    "GET_MY_ORDERS_VERSION",
    "KNOWLEDGE_QA_NAME",
    "KNOWLEDGE_QA_VERSION",
    "GetMyOrdersArguments",
    "GetMyOrdersResult",
    "KnowledgeCitation",
    "KnowledgeQaArguments",
    "KnowledgeQaResult",
    "OrderItemSummary",
    "OrderSummary",
    "consumer_readonly_registry",
    "enable_consumer_readonly_registry",
    "get_my_orders_tool",
    "knowledge_qa_tool",
]
