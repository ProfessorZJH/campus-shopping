"""Regression tests for live-integration polish:
1. Resilient JSON object extraction when remote LLMs wrap JSON with prose/fences while staying fail-closed on malformed payloads.
2. Mixed shopping + service inquiry answers include authorized public knowledge summaries without leaking non-egress internal documents.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.config import Settings
from app.engine import answer
from app.provider import ChatProvider
from app.retrieval import KnowledgeStore


def _settings(tmp_path: Path) -> Settings:
    return Settings(api_key="test-key", db_path=str(tmp_path / "polish.sqlite3"))


def test_parse_json_content_extracts_wrapped_object_and_rejects_malformed():
    assert ChatProvider.parse_json_content('{"answer":"ok","recommendations":[]}') == {
        "answer": "ok",
        "recommendations": [],
    }
    assert ChatProvider.parse_json_content('```json\n{"answer":"fenced"}\n```') == {"answer": "fenced"}
    assert ChatProvider.parse_json_content('好的，以下是结构化结果：\n```json\n{"answer":"prefixed"}\n```') == {
        "answer": "prefixed"
    }
    assert ChatProvider.parse_json_content('结果如下：{"answer":"inline","recommendations":[]} 谢谢。') == {
        "answer": "inline",
        "recommendations": [],
    }
    with pytest.raises((json.JSONDecodeError, ValueError)):
        ChatProvider.parse_json_content('{"answer": "truncated"')
    with pytest.raises(ValueError):
        ChatProvider.parse_json_content('["not-an-object"]')
    with pytest.raises(ValueError):
        ChatProvider.parse_json_content('{"a":1} {"b":2}')


def test_mixed_shopping_and_service_question_includes_authorized_knowledge_only(tmp_path: Path):
    settings = _settings(tmp_path)
    store = KnowledgeStore(settings)
    try:
        store.index(
            "doc-public",
            "自提时间与售后规则",
            "学一食堂东侧自提店每天08:30至22:00营业，付款备货完成后凭动态自提码取货。",
            external_allowed=True,
        )
        store.index(
            "doc-internal",
            "门店内部交接记录",
            "内部交接暗号 INTERNAL-SECRET-9988，营业前核对现金。",
            external_allowed=False,
        )
        offers = [
            {
                "skuId": "sku-tea-500",
                "merchantId": "m-1",
                "title": "无糖乌龙茶",
                "specKey": "500ml",
                "description": "清爽解腻无糖茶饮",
                "priceCent": 600,
                "available": 10,
            }
        ]

        mixed = answer(
            store,
            "预算20元买两瓶无糖乌龙茶，几点可以自提？",
            ["doc-public", "doc-internal"],
            offers,
            [],
            external_document_ids=["doc-public"],
        )
        assert mixed["recommendations"] and mixed["recommendations"][0]["skuId"] == "sku-tea-500"
        assert mixed["recommendations"][0]["quantity"] == 2
        assert "08:30" in mixed["answer"]
        assert "无糖乌龙茶" in mixed["answer"]
        assert "INTERNAL-SECRET-9988" not in mixed["answer"]

        pure_shopping = answer(
            store,
            "预算20元买两瓶无糖乌龙茶",
            ["doc-public", "doc-internal"],
            offers,
            [],
            external_document_ids=["doc-public"],
        )
        assert pure_shopping["recommendations"] and pure_shopping["recommendations"][0]["skuId"] == "sku-tea-500"
        assert "根据当前允许访问的知识资料" not in pure_shopping["answer"]
    finally:
        store.close()
