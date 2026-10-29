package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import java.util.*;
/** 对外字段白名单映射；不输出密码摘要、自提摘要、数据库 PO。 */
public final class ApiViews {
 private ApiViews(){}
 public static MerchantResponseDTO merchant(MerchantVO m){return MerchantResponseDTO.builder().merchantId(m.id()).name(m.name()).category(m.category()).status(m.status()).storeId(m.storeId()).storeName(m.storeName()).location(m.location()).build();}
 public static AdmissionResponseDTO admission(MerchantApplicationAggregate a){var d=a.getDetails();return AdmissionResponseDTO.builder().applicationId(a.getApplicationId()).merchantName(a.getMerchantName()).category(d==null?null:d.category()).contactName(d==null?null:d.contactName()).contactPhone(d==null?null:d.contactPhone()).storeName(d==null?null:d.storeName()).location(d==null?null:d.location()).status(a.getStatus().name()).rejectionReason(a.getRejectionReason()).merchantId(a.getOpenedMerchantId()).build();}
 public static MembershipResponseDTO membership(MembershipVO m){return MembershipResponseDTO.builder().merchantId(m.merchantId()).userId(m.userId()).role(m.role()).status(m.status()).build();}
 public static InvitationResponseDTO invitation(InvitationVO i){return InvitationResponseDTO.builder().id(i.id()).merchantId(i.merchantId()).targetUserId(i.targetUserId()).status(i.status()).expiresAt(i.expiresAt()).build();}
 public static ProductResponseDTO product(ProductAggregate p,Map<String,StockVO> stocks){return ProductResponseDTO.builder().productId(p.getId()).merchantId(p.getMerchantId()).storeId(p.getStoreId()).title(p.getTitle()).description(p.getDescription()).categoryCode(p.getCategoryCode()).imageUrl(p.getImageUrl()).status(p.getStatus()).version(p.getVersion()).skus(p.getSkus().stream().map(s->{StockVO st=stocks.get(s.id());return SkuResponseDTO.builder().skuId(s.id()).specKey(s.specKey()).priceCent(s.priceCent()).quoteVersion(p.getVersion()).status(s.status()).available(st==null?0:st.onHand()-st.reserved()).build();}).toList()).build();}
 public static StockResponseDTO stock(StockVO s){return StockResponseDTO.builder().skuId(s.skuId()).storeId(s.storeId()).onHand(s.onHand()).reserved(s.reserved()).available(s.onHand()-s.reserved()).version(s.version()).build();}
 public static AfterSaleResponseDTO afterSale(AfterSaleVO a){return a==null?null:AfterSaleResponseDTO.builder().id(a.id()).orderId(a.orderId()).merchantId(a.merchantId()).status(a.status()).reason(a.reason()).decisionReason(a.decisionReason()).createdAt(a.createdAt()).build();}
 public static OrderResponseDTO order(OrderAggregate o,PickupVO p,AfterSaleVO a){return OrderResponseDTO.builder().orderId(o.getId()).buyerId(o.getBuyerId()).merchantId(o.getMerchantId()).storeId(o.getStoreId()).status(o.getStatus()).totalCent(o.getTotalCent()).deadline(o.getDeadline()).createdAt(o.getCreatedAt()).items(o.getItems().stream().map(i->OrderItemResponseDTO.builder().skuId(i.skuId()).title(i.title()).specKey(i.specKey()).imageUrl(i.imageUrl()).unitPriceCent(i.unitPriceCent()).quantity(i.quantity()).build()).toList()).pickup(p==null?null:PickupResponseDTO.builder().status(p.status()).expiresAt(p.expiresAt()).build()).afterSale(afterSale(a)).build();}
 public static StatisticsResponseDTO statistics(TradingStatsVO s){return StatisticsResponseDTO.builder().totalOrders(s.totalOrders()).pendingCount(s.pendingCount()).paidCount(s.paidCount()).completedCount(s.completedCount()).refundedCount(s.refundedCount()).completedAmountCent(s.completedAmountCent()).build();}
}
