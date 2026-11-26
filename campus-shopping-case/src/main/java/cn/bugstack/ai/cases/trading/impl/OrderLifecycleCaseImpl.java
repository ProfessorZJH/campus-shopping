package cn.bugstack.ai.cases.trading.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderReviewVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 跨域写入不吞异常；事务代理回滚后才由 Controller 转换失败响应。 */
@Service
public class OrderLifecycleCaseImpl implements IOrderLifecycleCase {

    private static final int MAX_APPEAL_ROUNDS = 3;
    private static final DateTimeFormatter TRADE_TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Shanghai"));

    private final IOrderService trading;
    private final IOrderEventService events;
    private final IAfterSaleService afterSales;
    private final IFulfillmentService fulfillment;
    private final IInventoryService inventory;
    private final IAccessService access;
    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final IOrderQueryCase query;
    private final Clock clock;

    @Autowired(required = false)
    private ICampusRedisPort redisHub;

    @Autowired(required = false)
    private ICatalogService catalogService;

    public OrderLifecycleCaseImpl(
        IOrderService trading,
        IOrderEventService events,
        IAfterSaleService afterSales,
        IFulfillmentService fulfillment,
        IInventoryService inventory,
        IAccessService access,
        IUserAccountService accounts,
        IMerchantService merchants,
        IOrderQueryCase query,
        Clock clock
    ) {
        this.trading = trading;
        this.events = events;
        this.afterSales = afterSales;
        this.fulfillment = fulfillment;
        this.inventory = inventory;
        this.access = access;
        this.accounts = accounts;
        this.merchants = merchants;
        this.query = query;
        this.clock = clock;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel pay(String buyer, String id) {
        return pay(buyer, id, "WECHAT_PAY");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel pay(String buyer, String id, String channel) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        String normalizedChannel = channel == null || channel.isBlank() ? "WECHAT_PAY" : channel.trim().toUpperCase(Locale.ROOT);
        String tradeNo = generateTradeNo(normalizedChannel, clock.instant());
        if (o.pay(clock.instant(), normalizedChannel, tradeNo)) {
            merchants.requireActiveForNewTrade(o.getMerchantId());
            trading.recordPayment(o);
            String pickupCode = redisHub != null ? redisHub.nextPickupQueueCode(o.getStoreId()) : "";
            fulfillment.create(id, o.getMerchantId(), o.getStoreId(), buyer, pickupCode);
            trading.save(o);
            events.record(id, null, "PAYMENT_SUCCEEDED", buyer, "BUYER", "");
            recordPaidAnalyticsAndBroadcast(o, pickupCode);
        }
        return query.view(o);
    }

    private String generateTradeNo(String channel, Instant now) {
        String prefix = switch (channel) {
            case "ALIPAY" -> "ALI";
            case "CAMPUS_CARD" -> "CARD";
            default -> "WX";
        };
        String hex = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        return prefix + TRADE_TS.format(now) + hex;
    }

    private void recordPaidAnalyticsAndBroadcast(OrderAggregate o, String pickupCode) {
        if (redisHub == null) return;
        try {
            if (catalogService != null) {
                List<String> skuIds = o.getItems().stream().map(OrderItemEntity::skuId).toList();
                Map<String, String> skuToProduct = catalogService
                    .resolveOffers(skuIds)
                    .stream()
                    .collect(Collectors.toMap(SkuOfferVO::skuId, SkuOfferVO::productId, (a, b) -> a));
                Map<String, Integer> quantities = new LinkedHashMap<>();
                for (OrderItemEntity item : o.getItems()) {
                    String pid = skuToProduct.get(item.skuId());
                    if (pid != null && !pid.isBlank()) {
                        quantities.merge(pid, item.quantity(), Integer::sum);
                    }
                }
                if (!quantities.isEmpty()) {
                    redisHub.recordOrderPaid(new ArrayList<>(quantities.keySet()), Map.of(), quantities);
                }
            }
        } catch (RuntimeException ignored) {}
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "ORDER_PAID");
        payload.put("orderId", o.getId());
        payload.put("merchantId", o.getMerchantId());
        payload.put("pickupCode", pickupCode == null ? "" : pickupCode);
        payload.put("totalCent", o.getTotalCent());
        payload.put("paymentChannel", o.getPaymentChannel());
        payload.put("occurredAt", clock.instant().toString());
        redisHub.publishRealtimeEventAfterCommit("merchant:" + o.getMerchantId(), payload);
        redisHub.publishRealtimeEventAfterCommit("user:" + o.getBuyerId(), payload);
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel cancel(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        if (o.cancel()) {
            inventory.release(id);
            trading.save(o);
            events.record(id, null, "CANCELED", buyer, "BUYER", "");
        }
        return query.view(o);
    }

    @Transactional(rollbackFor = Exception.class)
    public void expire(String id) {
        OrderAggregate o = trading.orderForUpdate(id);
        if (o.expire(clock.instant())) {
            inventory.release(id);
            trading.save(o);
            events.record(id, null, "EXPIRED", null, "SYSTEM", "");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void startPreparing(String actor, String merchant, String id) {
        prepare(actor, merchant, id, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markReady(String actor, String merchant, String id) {
        prepare(actor, merchant, id, true);
    }

    private void prepare(String actor, String merchant, String id, boolean ready) {
        access.requirePermission(actor, merchant, "order.prepare");
        OrderAggregate o = trading.orderForUpdate(id);
        require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        boolean changed = ready ? fulfillment.markReady(id) : fulfillment.startPreparing(id);
        if (changed) {
            events.record(id, null, ready ? "READY" : "PREPARING", actor, "MERCHANT", "");
            if (redisHub != null) {
                PickupVO pickup = fulfillment.pickup(id);
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("type", ready ? "ORDER_READY" : "ORDER_PREPARING");
                payload.put("orderId", id);
                payload.put("merchantId", merchant);
                payload.put("pickupCode", pickup == null ? "" : pickup.pickupCode());
                payload.put("occurredAt", clock.instant().toString());
                redisHub.publishRealtimeEventAfterCommit("user:" + o.getBuyerId(), payload);
                redisHub.publishRealtimeEventAfterCommit("merchant:" + merchant, payload);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public PickupTokenVO issuePickupToken(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        PickupTokenVO issued = fulfillment.issue(id);
        if (redisHub != null && issued != null && issued.pinCode() != null && !issued.pinCode().isBlank()) {
            redisHub.storePickupPin(o.getMerchantId(), issued.pinCode(), id, issued.token(), 1200L);
        }
        return issued;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel verifyPickup(String actor, String merchant, String id, String token) {
        access.requirePermission(actor, merchant, "pickup.verify");
        OrderAggregate o = trading.orderForUpdate(id);
        require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(o.state() == OrderStatusEnumVO.PAID || o.state() == OrderStatusEnumVO.COMPLETED, ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        boolean changed;
        try {
            changed = fulfillment.verify(id, token, actor);
        } catch (AppException e) {
            if (ResponseCode.PICKUP_INVALID.getCode().equals(e.getCode()) && redisHub != null && token != null && token.trim().matches("\\d{6}")) {
                redisHub.recordPinFailure(merchant, actor);
            }
            throw e;
        }
        if (changed) {
            inventory.consume(id);
            o.complete();
            trading.save(o);
            access.audit(actor, "PICKUP_COMPLETED", id, merchant, "凭证核销成功");
            events.record(id, null, "PICKED_UP", actor, "MERCHANT", "");
            if (redisHub != null) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("type", "ORDER_PICKED_UP");
                payload.put("orderId", id);
                payload.put("merchantId", merchant);
                payload.put("occurredAt", clock.instant().toString());
                redisHub.publishRealtimeEventAfterCommit("user:" + o.getBuyerId(), payload);
                redisHub.publishRealtimeEventAfterCommit("merchant:" + merchant, payload);
            }
        }
        return query.view(o);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel quickVerifyPickup(String actor, String merchant, String code) {
        access.requirePermission(actor, merchant, "pickup.verify");
        String input = text(code, "核销码", 200);
        if (redisHub != null) redisHub.checkPinBruteForce(merchant, actor);
        String orderId = null;
        String verifyToken = input;
        if (input.startsWith("CS1|")) {
            String[] parts = input.split("\\|", 3);
            if (parts.length == 3 && !parts[1].isBlank() && !parts[2].isBlank()) {
                orderId = parts[1];
                verifyToken = parts[2];
            }
        } else if (input.matches("\\d{6}")) {
            if (redisHub != null) {
                String cached = redisHub.peekOrConsumePickupPin(merchant, input, true);
                if (cached != null && cached.contains("|")) {
                    int idx = cached.indexOf('|');
                    orderId = cached.substring(0, idx);
                    verifyToken = cached.substring(idx + 1);
                }
            }
            if (orderId == null) {
                PickupVO matched = fulfillment.findReadyByMerchantAndPin(merchant, input);
                if (matched != null) {
                    orderId = matched.orderId();
                    verifyToken = input;
                }
            }
        }
        if (orderId == null) {
            if (redisHub != null) redisHub.recordPinFailure(merchant, actor);
            throw new AppException(ResponseCode.PICKUP_INVALID);
        }
        try {
            return verifyPickup(actor, merchant, orderId, verifyToken);
        } catch (AppException e) {
            if (ResponseCode.PICKUP_INVALID.getCode().equals(e.getCode()) && redisHub != null && !input.matches("\\d{6}")) {
                redisHub.recordPinFailure(merchant, actor);
            }
            throw e;
        }
    }

    private void requireNoPendingRefund(String order) {
        afterSales.requirePickupAllowed(order);
    }

    @Transactional(rollbackFor = Exception.class)
    public AfterSaleVO requestRefund(String buyer, String id, String reason) {
        return requestRefund(buyer, id, reason, "");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AfterSaleVO requestRefund(String buyer, String id, String reason, String evidenceImageUrl) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        AfterSaleVO result = afterSales.requestAfterSale(o, buyer, reason, evidenceImageUrl);
        events.record(id, result.id(), "REFUND_REQUESTED", buyer, "BUYER", result.reason());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<OrderReviewVO> submitOrderReview(String buyer, String orderId, int rating, String tags, String content) {
        UserAccountAggregate account = accounts.requireActive(buyer);
        require(rating >= 1 && rating <= 5, ResponseCode.ILLEGAL_PARAMETER);
        String cleanTags = optional(tags, 200);
        String cleanContent = text(content, "评价内容", 500);
        OrderAggregate o = trading.orderForUpdate(orderId);
        o.requireBuyer(buyer);
        require(o.state() == OrderStatusEnumVO.COMPLETED, ResponseCode.ORDER_STATE_INVALID);
        require(!trading.hasOrderReviews(orderId), ResponseCode.STATE_CONFLICT);
        String displayName = account != null && account.getDisplayName() != null && !account.getDisplayName().isBlank() ? account.getDisplayName() : "校园买家";
        List<String> skuIds = o.getItems().stream().map(OrderItemEntity::skuId).toList();
        Map<String, String> skuToProduct = new LinkedHashMap<>();
        if (catalogService != null) {
            catalogService.resolveOffers(skuIds).forEach(offer -> skuToProduct.put(offer.skuId(), offer.productId()));
        }
        Set<String> productIds = new LinkedHashSet<>();
        for (OrderItemEntity item : o.getItems()) {
            productIds.add(skuToProduct.getOrDefault(item.skuId(), item.skuId()));
        }
        Instant now = clock.instant();
        List<OrderReviewVO> created = new ArrayList<>();
        for (String productId : productIds) {
            OrderReviewVO review = new OrderReviewVO(
                UUID.randomUUID().toString(),
                orderId,
                productId,
                o.getMerchantId(),
                buyer,
                displayName,
                rating,
                cleanTags,
                cleanContent,
                now
            );
            trading.insertReview(review);
            created.add(review);
        }
        events.record(orderId, null, "ORDER_REVIEWED", buyer, "BUYER", cleanContent);
        return List.copyOf(created);
    }

    @Transactional(rollbackFor = Exception.class)
    public void appeal(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        AfterSaleVO before = afterSales.afterSaleForUpdate(id);
        if (before != null && before.state() != AfterSaleStatusEnumVO.DISPUTED) {
            long disputeRounds = events
                .events(id)
                .stream()
                .filter(e -> "REFUND_DISPUTED".equals(e.type()))
                .count();
            require(disputeRounds < MAX_APPEAL_ROUNDS, ResponseCode.REFUND_STATE_INVALID);
        }
        AfterSaleVO result = afterSales.appeal(o, buyer);
        if (before == null || before.state() != AfterSaleStatusEnumVO.DISPUTED) {
            events.record(id, result.id(), "REFUND_DISPUTED", buyer, "BUYER", "");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void merchantApproveRefund(String actor, String merchant, String id, String reason) {
        merchantDecideRefund(actor, merchant, id, true, reason);
    }

    @Transactional(rollbackFor = Exception.class)
    public void merchantRejectRefund(String actor, String merchant, String id, String reason) {
        merchantDecideRefund(actor, merchant, id, false, reason);
    }

    private void merchantDecideRefund(String actor, String merchant, String id, boolean approved, String reason) {
        access.requirePermission(actor, merchant, "aftersale.review");
        decideRefund(actor, merchant, id, approved, reason, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public void platformApproveRefund(String actor, String id, String reason) {
        platformDecideRefund(actor, id, true, reason);
    }

    @Transactional(rollbackFor = Exception.class)
    public void platformRejectRefund(String actor, String id, String reason) {
        platformDecideRefund(actor, id, false, reason);
    }

    private void platformDecideRefund(String actor, String id, boolean approved, String reason) {
        access.requireAdmin(actor);
        decideRefund(actor, null, id, approved, reason, true);
    }

    private void decideRefund(String actor, String merchant, String id, boolean approved, String reason, boolean platform) {
        OrderAggregate o = trading.orderForUpdate(id);
        if (!platform) require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        AfterSaleVO a = afterSales.afterSaleForUpdate(id);
        require(a != null, ResponseCode.NOT_FOUND);
        if (a.state() == AfterSaleStatusEnumVO.APPROVED && o.state() == OrderStatusEnumVO.REFUNDED && approved) return;
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
        AfterSaleAggregate review = new AfterSaleAggregate(a);
        if (platform) review.requirePlatformReview();
        else review.requireMerchantReview();
        if (approved) {
            afterSales.approveAfterSale(id, reason);
            fulfillment.cancel(id);
            inventory.release(id);
            trading.recordRefund(o);
            o.refund();
            trading.save(o);
            events.record(id, a.id(), platform ? "PLATFORM_APPROVED" : "MERCHANT_APPROVED", actor, platform ? "PLATFORM" : "MERCHANT", reason);
            events.record(id, a.id(), "REFUND_COMPLETED", actor, "SYSTEM", "");
        } else if (!afterSales.rejectAfterSale(id, reason)) return;
        else {
            events.record(id, a.id(), platform ? "PLATFORM_REJECTED" : "MERCHANT_REJECTED", actor, platform ? "PLATFORM" : "MERCHANT", reason);
        }
        access.audit(actor, approved ? "REFUND_APPROVED" : "REFUND_REJECTED", id, o.getMerchantId(), text(reason, "审核意见", 500));
    }
}
