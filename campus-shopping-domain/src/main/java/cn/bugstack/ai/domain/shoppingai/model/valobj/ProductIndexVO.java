package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.util.List;

/** 无价格、库存或敏感权限字段，供公开商品语义索引使用。 */
public record ProductIndexVO(String productId, String merchantId, String title, String description, String categoryCode, List<String> specs) {}
