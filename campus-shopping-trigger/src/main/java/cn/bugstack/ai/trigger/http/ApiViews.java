package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.dto.AdmissionResponseDTO;
import cn.bugstack.ai.api.dto.AfterSaleResponseDTO;
import cn.bugstack.ai.api.dto.CartResponseDTO;
import cn.bugstack.ai.api.dto.InvitationResponseDTO;
import cn.bugstack.ai.api.dto.MembershipResponseDTO;
import cn.bugstack.ai.api.dto.MerchantResponseDTO;
import cn.bugstack.ai.api.dto.OrderItemResponseDTO;
import cn.bugstack.ai.api.dto.OrderResponseDTO;
import cn.bugstack.ai.api.dto.PickupResponseDTO;
import cn.bugstack.ai.api.dto.ProductResponseDTO;
import cn.bugstack.ai.api.dto.SkuResponseDTO;
import cn.bugstack.ai.api.dto.StatisticsResponseDTO;
import cn.bugstack.ai.api.dto.StockResponseDTO;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.trading.model.CartItemReadModel;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.identity.model.valobj.InvitationVO;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;

/** 对外字段白名单映射；不输出密码摘要、自提摘要、数据库 PO。 */
public final class ApiViews {

    private ApiViews() {}

    public static MerchantResponseDTO merchant(MerchantVO m) {
        return MerchantResponseDTO.builder()
            .merchantId(m.id())
            .name(m.name())
            .category(m.category())
            .status(m.status())
            .storeId(m.storeId())
            .storeName(m.storeName())
            .location(m.location())
            .build();
    }

    public static AdmissionResponseDTO admission(MerchantApplicationAggregate a) {
        var d = a.getDetails();
        return AdmissionResponseDTO.builder()
            .applicationId(a.getApplicationId())
            .merchantName(a.getMerchantName())
            .category(d == null ? null : d.category())
            .contactName(d == null ? null : d.contactName())
            .contactPhone(d == null ? null : d.contactPhone())
            .storeName(d == null ? null : d.storeName())
            .location(d == null ? null : d.location())
            .status(a.getStatus().name())
            .rejectionReason(a.getRejectionReason())
            .merchantId(a.getOpenedMerchantId())
            .build();
    }

    public static MembershipResponseDTO membership(MembershipVO m) {
        return MembershipResponseDTO.builder().merchantId(m.merchantId()).userId(m.userId()).role(m.role()).status(m.status()).build();
    }

    public static InvitationResponseDTO invitation(InvitationVO i) {
        return InvitationResponseDTO.builder()
            .id(i.id())
            .merchantId(i.merchantId())
            .targetUserId(i.targetUserId())
            .status(i.status())
            .expiresAt(i.expiresAt())
            .build();
    }

    public static ProductResponseDTO product(ProductReadModel model) {
        ProductAggregate p = model.product();
        return ProductResponseDTO.builder()
            .productId(p.getId())
            .merchantName(model.merchantName())
            .merchantId(p.getMerchantId())
            .storeId(p.getStoreId())
            .title(p.getTitle())
            .description(p.getDescription())
            .categoryCode(p.getCategoryCode())
            .imageUrl(p.getImageUrl())
            .status(p.getStatus())
            .version(p.getVersion())
            .skus(
                p
                    .getSkus()
                    .stream()
                    .map(s -> {
                        return SkuResponseDTO.builder()
                            .skuId(s.id())
                            .specKey(s.specKey())
                            .priceCent(s.priceCent())
                            .quoteVersion(p.getVersion())
                            .status(s.status())
                            .available(model.availableBySku().get(s.id()))
                            .build();
                    })
                    .toList()
            )
            .build();
    }

    public static StockResponseDTO stock(StockVO s) {
        return StockResponseDTO.builder()
            .skuId(s.skuId())
            .storeId(s.storeId())
            .onHand(s.onHand())
            .reserved(s.reserved())
            .available(s.onHand() - s.reserved())
            .version(s.version())
            .build();
    }

    public static AfterSaleResponseDTO afterSale(AfterSaleVO a) {
        return a == null
            ? null
            : AfterSaleResponseDTO.builder()
                  .id(a.id())
                  .orderId(a.orderId())
                  .merchantId(a.merchantId())
                  .status(a.status())
                  .reason(a.reason())
                  .decisionReason(a.decisionReason())
                  .createdAt(a.createdAt())
                  .build();
    }

    public static OrderResponseDTO order(OrderReadModel model) {
        PickupVO p = model.pickup();
        AfterSaleVO a = model.afterSale();
        return OrderResponseDTO.builder()
            .orderId(model.orderId())
            .merchantName(model.merchantName())
            .buyerId(model.buyerId())
            .merchantId(model.merchantId())
            .storeId(model.storeId())
            .status(model.status())
            .totalCent(model.totalCent())
            .deadline(model.deadline())
            .createdAt(model.createdAt())
            .items(
                model
                    .items()
                    .stream()
                    .map(i ->
                        OrderItemResponseDTO.builder()
                            .skuId(i.skuId())
                            .title(i.title())
                            .specKey(i.specKey())
                            .imageUrl(i.imageUrl())
                            .unitPriceCent(i.unitPriceCent())
                            .quantity(i.quantity())
                            .build()
                    )
                    .toList()
            )
            .pickup(p == null ? null : PickupResponseDTO.builder().status(p.status()).expiresAt(p.expiresAt()).build())
            .afterSale(afterSale(a))
            .build();
    }

    public static CartResponseDTO cart(CartItemReadModel model) {
        var item = model.item();
        var offer = model.offer();
        return CartResponseDTO.builder()
            .merchantId(item.merchantId())
            .merchantName(model.merchantName())
            .skuId(item.skuId())
            .title(offer.title())
            .specKey(offer.specKey())
            .imageUrl(offer.imageUrl())
            .priceCent(offer.priceCent())
            .quoteVersion(offer.version())
            .quantity(item.quantity())
            .available(model.available())
            .sellable(model.sellable())
            .build();
    }

    public static StatisticsResponseDTO statistics(TradingStatsVO s) {
        return StatisticsResponseDTO.builder()
            .totalOrders(s.totalOrders())
            .pendingCount(s.pendingCount())
            .paidCount(s.paidCount())
            .completedCount(s.completedCount())
            .refundedCount(s.refundedCount())
            .completedAmountCent(s.completedAmountCent())
            .build();
    }
}
