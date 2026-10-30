package cn.bugstack.ai.cases.trading.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.trading.ICheckoutCase;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.SkuQuantityVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.*;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 锁顺序：请求闸门 -> 用户购物车 -> 商户 -> 商品/SKU -> 排序库存；失败整体回滚。 */
@Service
public class CheckoutCaseImpl implements ICheckoutCase {

    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IOrderService trading;
    private final ICartService cart;
    private final Clock clock;

    @Value("${campus.order.payment-minutes:15}")
    private long paymentMinutes = 15;

    public CheckoutCaseImpl(
        IUserAccountService accounts,
        IMerchantService merchants,
        ICatalogService catalog,
        IInventoryService inventory,
        IOrderService trading,
        ICartService cart,
        Clock clock
    ) {
        this.accounts = accounts;
        this.merchants = merchants;
        this.catalog = catalog;
        this.inventory = inventory;
        this.trading = trading;
        this.cart = cart;
        this.clock = clock;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderAggregate checkout(String buyer, String merchant, List<CheckoutItemEntity> items, String requestKey) {
        accounts.requireActive(buyer);
        String key = text(requestKey, "下单幂等键", 64);
        text(merchant, "商户编号", 36);
        require(items != null && !items.isEmpty() && items.size() <= 20, ResponseCode.ILLEGAL_PARAMETER);
        Set<String> seen = new HashSet<>();
        for (var i : items)
            require(
                i != null &&
                    i.skuId() != null &&
                    seen.add(i.skuId()) &&
                    i.quantity() > 0 &&
                    i.quantity() <= 99 &&
                    i.expectedPriceCent() > 0 &&
                    i.expectedVersion() >= 0,
                ResponseCode.ILLEGAL_PARAMETER
            );
        List<CheckoutItemEntity> sorted = items.stream().sorted(Comparator.comparing(CheckoutItemEntity::skuId)).toList();
        List<Object> fp = new ArrayList<>();
        fp.add(merchant);
        for (var i : sorted) {
            fp.add(i.skuId());
            fp.add(i.quantity());
            fp.add(i.expectedPriceCent());
            fp.add(i.expectedVersion());
        }
        String existing = trading.beginCheckout(buyer, key, Fingerprints.of(fp.toArray()));
        if (existing != null) return trading.orderForUpdate(existing);
        cart.lockCart(buyer);
        var m = merchants.requireActiveForNewTrade(merchant);
        Map<String, SkuOfferVO> offers = catalog
            .saleOffersForUpdate(sorted.stream().map(CheckoutItemEntity::skuId).toList())
            .stream()
            .collect(Collectors.toMap(SkuOfferVO::skuId, o -> o));
        List<OrderItemEntity> snapshots = new ArrayList<>();
        List<SkuQuantityVO> quantities = new ArrayList<>();
        for (var i : sorted) {
            SkuOfferVO o = offers.get(i.skuId());
            require(merchant.equals(o.merchantId()) && m.storeId().equals(o.storeId()), ResponseCode.ORDER_MIXED_MERCHANT);
            require(o.priceCent() == i.expectedPriceCent() && o.version() == i.expectedVersion(), ResponseCode.PRICE_CHANGED);
            snapshots.add(new OrderItemEntity(o.skuId(), o.title(), o.specKey(), o.priceCent(), i.quantity(), o.imageUrl()));
            quantities.add(new SkuQuantityVO(o.skuId(), i.quantity()));
        }
        String orderId = UUID.randomUUID().toString();
        inventory.reserve(orderId, merchant, m.storeId(), quantities);
        OrderAggregate order = trading.create(
            orderId,
            buyer,
            merchant,
            m.storeId(),
            snapshots,
            clock.instant().plus(Duration.ofMinutes(Math.max(1, Math.min(paymentMinutes, 60))))
        );
        cart.consumeCart(buyer, snapshots);
        trading.finishCheckout(buyer, key, orderId);
        return order;
    }
}
