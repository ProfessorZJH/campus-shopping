package cn.bugstack.ai.cases.trading.model;

import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import java.util.Objects;

/** 购物车的一行展示快照；可售标记仅用于展示，交易仍在 Java 事务内复核。 */
public record CartItemReadModel(CartItemVO item, SkuOfferVO offer, String merchantName, long available, boolean sellable) {
    public CartItemReadModel {
        Objects.requireNonNull(item);
        Objects.requireNonNull(offer);
        Objects.requireNonNull(merchantName);
        if (merchantName.isBlank()) throw new IllegalArgumentException("购物车商户名不能为空");
    }
}
