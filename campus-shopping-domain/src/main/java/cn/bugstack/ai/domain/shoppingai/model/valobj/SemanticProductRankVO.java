package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 语义召回的稳定商品排名；不能用数据库返回顺序或商品 ID 代替。 */
public record SemanticProductRankVO(String productId, int rank, boolean degraded) {
    public SemanticProductRankVO(String productId, int rank) {
        this(productId, rank, false);
    }

    public SemanticProductRankVO {
        if (productId == null || productId.isBlank() || rank < 1) throw new IllegalArgumentException("语义商品排名无效");
    }
}
