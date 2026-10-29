package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.ICheckoutCase;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.SkuQuantityVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 下单跨领域编排。
 * 锁顺序：幂等闸门 → 用户购物车 → 商户 → 商品/SKU → 按 SKU 排序的库存。
 * 任意一步失败均由这一层的单个本地事务回滚，不能拆成独立的 Service 事务。
 */
@Service
public class CheckoutCaseImpl implements ICheckoutCase {
    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IOrderService orders;
    private final ICartService cart;
    private final Clock clock;

    @Value("${campus.order.payment-minutes:15}")
    private long paymentMinutes = 15;

    public CheckoutCaseImpl(IUserAccountService accounts, IMerchantService merchants,
                            ICatalogService catalog, IInventoryService inventory,
                            IOrderService orders, ICartService cart, Clock clock) {
        this.accounts = accounts;
        this.merchants = merchants;
        this.catalog = catalog;
        this.inventory = inventory;
        this.orders = orders;
        this.cart = cart;
        this.clock = clock;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderAggregate checkout(String buyer, String merchant,
                                   List<CheckoutItemEntity> items, String requestKey) {
        accounts.requireActive(buyer);
        String key = text(requestKey, "下单幂等键", 64);
        text(merchant, "商户编号", 36);
        require(items != null && !items.isEmpty() && items.size() <= 20,
                ResponseCode.ILLEGAL_PARAMETER);

        Set<String> seen = new HashSet<>();
        for (CheckoutItemEntity item : items) {
            require(item != null && item.skuId() != null && seen.add(item.skuId())
                            && item.quantity() > 0 && item.quantity() <= 99
                            && item.expectedPriceCent() > 0 && item.expectedVersion() >= 0,
                    ResponseCode.ILLEGAL_PARAMETER);
        }

        List<CheckoutItemEntity> sorted = items.stream()
                .sorted(Comparator.comparing(CheckoutItemEntity::skuId)).toList();
        List<Object> fingerprintParts = new ArrayList<>();
        fingerprintParts.add(merchant);
        for (CheckoutItemEntity item : sorted) {
            fingerprintParts.add(item.skuId());
            fingerprintParts.add(item.quantity());
            fingerprintParts.add(item.expectedPriceCent());
            fingerprintParts.add(item.expectedVersion());
        }

        // 同一请求键重试直接返回原订单，不能再次预占库存。
        String existing = orders.beginCheckout(buyer, key,
                Fingerprints.of(fingerprintParts.toArray()));
        if (existing != null) {
            return orders.order(existing, true);
        }

        cart.lockCart(buyer);
        var activeMerchant = merchants.requireActiveForNewTrade(merchant);
        Map<String, SkuOfferVO> offers = catalog.offers(
                sorted.stream().map(CheckoutItemEntity::skuId).toList(), true, true)
                .stream().collect(Collectors.toMap(SkuOfferVO::skuId, offer -> offer));

        List<OrderItemEntity> snapshots = new ArrayList<>();
        List<SkuQuantityVO> quantities = new ArrayList<>();
        for (CheckoutItemEntity item : sorted) {
            SkuOfferVO offer = offers.get(item.skuId());
            require(merchant.equals(offer.merchantId())
                            && activeMerchant.storeId().equals(offer.storeId()),
                    ResponseCode.ORDER_MIXED_MERCHANT);
            require(offer.priceCent() == item.expectedPriceCent()
                            && offer.version() == item.expectedVersion(),
                    ResponseCode.PRICE_CHANGED);
            snapshots.add(new OrderItemEntity(offer.skuId(), offer.title(), offer.specKey(),
                    offer.priceCent(), item.quantity(), offer.imageUrl()));
            quantities.add(new SkuQuantityVO(offer.skuId(), item.quantity()));
        }

        String orderId = UUID.randomUUID().toString();
        inventory.reserve(orderId, merchant, activeMerchant.storeId(), quantities);
        OrderAggregate order = orders.create(orderId, buyer, merchant, activeMerchant.storeId(),
                snapshots, clock.instant().plus(Duration.ofMinutes(
                        Math.max(1, Math.min(paymentMinutes, 60)))));
        cart.consumeCart(buyer, snapshots);
        orders.finishCheckout(buyer, key, orderId);
        return order;
    }
}
