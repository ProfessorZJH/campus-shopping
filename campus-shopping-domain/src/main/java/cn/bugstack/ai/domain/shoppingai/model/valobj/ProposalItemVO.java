package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 用户确认前冻结的商品建议快照，非最终成交价格。 */
public record ProposalItemVO(
    String skuId,
    String merchantId,
    String title,
    String specKey,
    long priceCent,
    long quoteVersion,
    int quantity,
    String imageUrl,
    String productId
) {
    /** 兼容历史 Java 调用；旧提案 JSON 没有 productId 时保持可反序列化。 */
    public ProposalItemVO(String skuId, String merchantId, String title, String specKey, long priceCent, long quoteVersion, int quantity, String imageUrl) {
        this(skuId, merchantId, title, specKey, priceCent, quoteVersion, quantity, imageUrl, null);
    }

    /** 兼容历史 Java 调用；反序列化旧 JSON 缺少 imageUrl 时允许为 null。 */
    public ProposalItemVO(String skuId, String merchantId, String title, String specKey, long priceCent, long quoteVersion, int quantity) {
        this(skuId, merchantId, title, specKey, priceCent, quoteVersion, quantity, "", null);
    }

    public boolean hasProductId() {
        return productId != null && !productId.isBlank();
    }
}
