from app.ranking import reciprocal_rank_contribution, reciprocal_rank_fusion, stable_top_k
from app.config import Settings
from app.engine import answer


def test_reciprocal_rank_fusion_accumulates_each_rank():
    scores = reciprocal_rank_fusion(
        [("first", 0.9), ("shared", 0.8)],
        [("shared", 0.95), ("other", 0.7)],
    )

    assert scores["shared"] == 1 / 62 + 1 / 61
    assert scores["first"] == 1 / 61
    assert scores["other"] == 1 / 62


def test_stable_top_k_uses_explicit_tie_breaker_and_limit():
    scores = {"b": 1.0, "a": 1.0, "c": 0.5}

    assert stable_top_k(scores, tie_breaker=lambda item: item) == ["a", "b", "c"]
    assert stable_top_k(scores, tie_breaker=lambda item: item, limit=2) == ["a", "b"]


def test_empty_rankings_and_unlimited_selection_are_safe():
    assert reciprocal_rank_fusion([], []) == {}
    assert stable_top_k({}, tie_breaker=lambda item: item) == []


def test_explicit_rank_contribution_preserves_external_rank_gaps():
    assert reciprocal_rank_contribution(3) == 1 / 63


def test_answer_keeps_external_semantic_rank_gaps_after_eligibility_filtering():
    class Store:
        settings = Settings("test-only-service-key-123456", ":memory:")
        provider = object()

        def search(self, *args, **kwargs):
            return [], "LOCAL_CHAR_NGRAM_DEMO"

    result = answer(
        Store(),
        "xyz",
        [],
        [
            {"skuId": "a", "title": "apple", "specKey": "standard", "description": "", "priceCent": 100, "available": 1},
            {"skuId": "b", "title": "banana", "specKey": "standard", "description": "", "priceCent": 100, "available": 1},
        ],
        [],
        semantic_sku_ids=["filtered-out", "b", "a"],
    )

    assert result["recommendations"][0]["skuId"] == "b"
