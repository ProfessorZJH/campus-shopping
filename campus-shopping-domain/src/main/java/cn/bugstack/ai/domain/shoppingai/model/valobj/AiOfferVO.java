package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 仅传递可售商品必要资料给远程 AI 服务。 */
public record AiOfferVO(String skuId, String merchantId, String title, String specKey, String description, long priceCent, long available) {}
