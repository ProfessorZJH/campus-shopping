"""Agent v1.1 M1 的受控只读工具契约。

本模块是独立实验运行时的边界，不向 FastAPI 暴露新入口，也不持有交易写能力。
模型只能通过代码登记的工具名和 Pydantic 生成的 JSON Schema 请求查询；Scope、
资源归属和只读回执由服务端校验。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Literal, Mapping, Protocol, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError


TOOL_NAME = "search_products"
TOOL_VERSION = "1.0"
PRODUCT_SEARCH_PERMISSION = "catalog.product.search"


class AgentContractError(RuntimeError):
    """对外只暴露稳定错误码，不携带模型、凭据或下游正文。"""

    code = "AGENT_CONTRACT_ERROR"

    def __init__(self, code: str | None = None):
        super().__init__(code or self.code)
        self.code = code or self.code


class UnknownToolError(AgentContractError):
    code = "UNKNOWN_TOOL"

    def __init__(self):
        super().__init__(self.code)


class ToolArgumentError(AgentContractError):
    code = "INVALID_TOOL_ARGUMENTS"

    def __init__(self):
        super().__init__(self.code)


class ToolOutputError(AgentContractError):
    code = "INVALID_TOOL_RESULT"

    def __init__(self):
        super().__init__(self.code)


class ScopeDeniedError(AgentContractError):
    code = "SCOPE_DENIED"

    def __init__(self, code: str | None = None):
        super().__init__(code or self.code)


class SearchProductsArguments(BaseModel):
    """首期商品查询输入；extra=forbid 防止模型注入未声明字段。"""

    model_config = ConfigDict(extra="forbid", strict=True)

    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=20)
    merchantId: str | None = Field(default=None, min_length=1, max_length=64)


class ProductCandidate(BaseModel):
    """只读候选快照；价格/库存等交易事实不由实验工具声明。"""

    model_config = ConfigDict(extra="forbid", strict=True)

    productId: str = Field(min_length=1, max_length=64)
    merchantId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=100)
    source: Literal["CATALOG_READ_MODEL", "MILVUS_CANDIDATE"]
    verified: bool


class SearchProductsResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    tool: Literal["search_products"]
    version: Literal["1.0"]
    readOnly: Literal[True]
    candidates: list[ProductCandidate] = Field(max_length=20)


@dataclass(frozen=True)
class AgentScope:
    """服务端生成的本轮身份和资源快照。

    ``authorizedMerchantIds`` 可以包含多个商户，但具体商户筛选仍必须由本轮
    明确参数选择；模型自报的 active_role 不在该结构中。
    """

    user_id: str
    identity_kind: Literal["consumer", "merchant"]
    identity_id: str | None = None
    authorized_merchant_ids: frozenset[str] = frozenset()
    permissions: frozenset[str] = frozenset()
    authorization_source: str = "java"
    turn_token: str | None = None
    turn_expires_at: float | None = None

    def assert_active(self, now: float | None = None) -> None:
        if self.turn_expires_at is None:
            return
        current = now if now is not None else datetime.now(timezone.utc).timestamp()
        if current >= self.turn_expires_at:
            raise ScopeDeniedError("TURN_LEASE_EXPIRED")

    def assert_product_search(self, merchant_id: str | None) -> None:
        self.assert_active()
        if PRODUCT_SEARCH_PERMISSION not in self.permissions:
            raise ScopeDeniedError("PRODUCT_SEARCH_NOT_AUTHORIZED")
        if merchant_id is None:
            # 消费者可查询公开目录；商户多身份必须先选择具体范围。
            if self.identity_kind == "merchant" and len(self.authorized_merchant_ids) > 1:
                raise ScopeDeniedError("MERCHANT_SCOPE_AMBIGUOUS")
            return
        if merchant_id not in self.authorized_merchant_ids:
            raise ScopeDeniedError("MERCHANT_RESOURCE_DENIED")
        if self.identity_kind == "merchant" and self.identity_id not in (None, merchant_id):
            raise ScopeDeniedError("MERCHANT_IDENTITY_MISMATCH")


class ProductSearchPort(Protocol):
    def __call__(
        self,
        query: str,
        limit: int,
        merchant_id: str | None,
        scope: AgentScope,
    ) -> list[Mapping[str, Any]]: ...


InputModel = TypeVar("InputModel", bound=BaseModel)
OutputModel = TypeVar("OutputModel", bound=BaseModel)


@dataclass(frozen=True)
class ToolSpec:
    name: str
    version: str
    description: str
    input_model: type[BaseModel]
    output_model: type[BaseModel]
    handler: Callable[[BaseModel, AgentScope], Mapping[str, Any]]
    read_only: bool = True

    def definition(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_model.model_json_schema(),
            },
        }

    def invoke(self, arguments: Mapping[str, Any], scope: AgentScope) -> dict[str, Any]:
        if not self.read_only:
            raise ScopeDeniedError("WRITE_TOOL_BLOCKED")
        if not isinstance(arguments, Mapping):
            raise ToolArgumentError()
        try:
            parsed = self.input_model.model_validate(dict(arguments), strict=True)
        except (TypeError, ValueError, ValidationError):
            raise ToolArgumentError() from None
        if isinstance(parsed, SearchProductsArguments):
            scope.assert_product_search(parsed.merchantId)
        try:
            raw = self.handler(parsed, scope)
            result = self.output_model.model_validate(raw, strict=True)
        except AgentContractError:
            raise
        except (TypeError, ValueError, ValidationError):
            raise ToolOutputError() from None
        return result.model_dump(mode="json")


class ToolRegistry:
    """只允许代码显式登记的工具，不接受模型提供的可执行地址。"""

    def __init__(self, specs: list[ToolSpec] | tuple[ToolSpec, ...] = ()):
        self._specs: dict[str, ToolSpec] = {}
        for spec in specs:
            self.register(spec)

    def register(self, spec: ToolSpec) -> None:
        if not spec.name or spec.name in self._specs:
            raise ValueError("工具名称重复")
        if not spec.read_only:
            raise ValueError("M1 只允许注册只读工具")
        self._specs[spec.name] = spec

    def get(self, name: str) -> ToolSpec:
        if not isinstance(name, str) or name not in self._specs:
            raise UnknownToolError()
        return self._specs[name]

    def definitions(self) -> list[dict[str, Any]]:
        return [self._specs[name].definition() for name in sorted(self._specs)]

    def invoke(self, name: str, arguments: Mapping[str, Any], scope: AgentScope) -> dict[str, Any]:
        return self.get(name).invoke(arguments, scope)


def search_products_tool(searcher: ProductSearchPort) -> ToolSpec:
    """用可信的查询 Port 注册商品检索工具。"""

    def handler(arguments: BaseModel, scope: AgentScope) -> Mapping[str, Any]:
        assert isinstance(arguments, SearchProductsArguments)
        candidates = searcher(arguments.query, arguments.limit, arguments.merchantId, scope)
        normalized = []
        for candidate in candidates[: arguments.limit]:
            normalized.append(
                ProductCandidate.model_validate(
                    {
                        "productId": candidate.get("productId"),
                        "merchantId": candidate.get("merchantId"),
                        "title": candidate.get("title"),
                        "source": candidate.get("source", "CATALOG_READ_MODEL"),
                        "verified": candidate.get("verified", False),
                    },
                    strict=True,
                ).model_dump(mode="json")
            )
        return {
            "tool": TOOL_NAME,
            "version": TOOL_VERSION,
            "readOnly": True,
            "candidates": normalized,
        }

    return ToolSpec(
        name=TOOL_NAME,
        version=TOOL_VERSION,
        description="只读检索当前 Scope 可访问的校园商城商品候选。",
        input_model=SearchProductsArguments,
        output_model=SearchProductsResult,
        handler=handler,
    )


def default_registry(searcher: ProductSearchPort) -> ToolRegistry:
    """M1 默认注册表：只有 search_products。"""

    return ToolRegistry((search_products_tool(searcher),))
