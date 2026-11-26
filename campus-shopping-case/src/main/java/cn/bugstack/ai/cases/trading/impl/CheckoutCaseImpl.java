package cn.bugstack.ai.cases.trading.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.trading.ICheckoutCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.SkuQuantityVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.*;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.domain.trading.service.IOrderDelayScheduler;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 锁顺序：请求闸门 -> 用户购物车 -> 商户 -> 商品/SKU -> 排序库存；失败整体回滚。 */
@Service
public class CheckoutCaseImpl implements ICheckoutCase {

    private static final int MAX_PENDING_ORDERS_24H = 10;

    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IOrderService trading;
    private final IOrderEventService events;
    private final ICartService cart;
    private final IOrderQueryCase query;
    private final Clock clock;

    @Autowired(required = false)
    private IOrderQueryService orderQuery;

    @Autowired(required = false)
    private IOrderDelayScheduler delayScheduler;

    @Autowired(required = false)
    private ICampusRedisPort redisHub;

    @Value("${campus.order.payment-minutes:15}")
    private long paymentMinutes = 15;

    public CheckoutCaseImpl(
        IUserAccountService accounts,
        IMerchantService merchants,
        ICatalogService catalog,
        IInventoryService inventory,
        IOrderService trading,
        IOrderEventService events,
        ICartService cart,
        IOrderQueryCase query,
        Clock clock
    ) {
        this.accounts = accounts;
        this.merchants = merchants;
        this.catalog = catalog;
        this.inventory = inventory;
        this.trading = trading;
        this.events = events;
        this.cart = cart;
        this.query = query;
        this.clock = clock;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel checkout(String buyer, String merchant, List<CheckoutItemEntity> items, String requestKey) {
        return checkout(buyer, merchant, items, requestKey, "", "IMMEDIATE");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel checkout(String buyer, String merchant, List<CheckoutItemEntity> items, String requestKey, String buyerRemark, String pickupSlot) {
        accounts.requireActive(buyer);
        String key = text(requestKey, "下单幂等键", 64);
        text(merchant, "商户编号", 36);
        String cleanRemark = optional(buyerRemark, 200);
        String rawSlot = optional(pickupSlot, 64);
        String cleanSlot = rawSlot.isEmpty() ? "IMMEDIATE" : rawSlot;
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
        if (!cleanRemark.isEmpty() || !"IMMEDIATE".equals(cleanSlot)) {
            fp.add(cleanRemark);
            fp.add(cleanSlot);
        }
        for (var i : sorted) {
            fp.add(i.skuId());
            fp.add(i.quantity());
            fp.add(i.expectedPriceCent());
            fp.add(i.expectedVersion());
        }
        String existing = trading.beginCheckout(buyer, key, Fingerprints.of(fp.toArray()));
        if (existing != null) return query.view(trading.orderForUpdate(existing));
        if (orderQuery != null) {
            long pending = orderQuery.countOrders(buyer, null, "PENDING_PAYMENT", "", clock.instant().minus(Duration.ofHours(24)));
            if (pending >= MAX_PENDING_ORDERS_24H) {
                if (redisHub != null) redisHub.recordOrderBrushBlocked();
                throw new AppException(ResponseCode.AUTH_RATE_LIMITED.getCode(), "未付款订单过多，请先完成支付或取消旧单");
            }
        }
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
        long minutes = Math.max(1, Math.min(paymentMinutes, 60));
        OrderAggregate order = trading.create(
            orderId,
            buyer,
            merchant,
            m.storeId(),
            m.storeName(),
            m.location(),
            cleanRemark,
            cleanSlot,
            snapshots,
            clock.instant().plus(Duration.ofMinutes(minutes))
        );
        cart.consumeCart(buyer, snapshots);
        trading.finishCheckout(buyer, key, orderId);
        events.record(orderId, null, "ORDER_CREATED", buyer, "BUYER", "");
        if (delayScheduler != null) {
            delayScheduler.scheduleOrderExpiryAfterCommit(orderId, minutes * 60L);
        }
        return query.view(order);
    }
}
