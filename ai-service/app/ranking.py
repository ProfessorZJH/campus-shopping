"""纯检索排名融合原语；不访问存储、供应商或业务事实。"""
from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TypeVar


ItemT = TypeVar("ItemT")
RankedItem = tuple[ItemT, float]


def reciprocal_rank_contribution(rank: int, *, k: int = 60) -> float:
    """返回一个显式排名在 RRF 中的贡献分数。"""
    if k < 0:
        raise ValueError("RRF 常数不能为负数")
    if rank < 1:
        raise ValueError("排名必须从 1 开始")
    return 1 / (k + rank)


def reciprocal_rank_fusion(
    *rankings: Sequence[RankedItem],
    k: int = 60,
) -> dict[ItemT, float]:
    """按既有 RRF 公式合并多个有序排名。

    排名从 1 开始，函数保留输入排名的遍历顺序，以便调用方在分数相同时
    继续使用自己的稳定 tie-break。相同 item 在同一或不同排名中的出现会
    逐项累加，调用方负责在进入这里前维护候选排名的去重语义。
    """
    scores: dict[ItemT, float] = {}
    for ranking in rankings:
        for rank, (item, _) in enumerate(ranking, 1):
            scores[item] = scores.get(item, 0.0) + reciprocal_rank_contribution(rank, k=k)
    return scores


def stable_top_k(
    scores: Mapping[ItemT, float],
    *,
    tie_breaker: Callable[[ItemT], object],
    limit: int | None = None,
) -> list[ItemT]:
    """按分数降序和调用方 tie-break 稳定选择排名项。"""
    ordered = sorted(scores, key=lambda item: (-scores[item], tie_breaker(item)))
    return ordered if limit is None else ordered[:limit]
