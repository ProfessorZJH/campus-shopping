package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 AfterSaleController 实现。 */
public interface IAfterSaleApi {
  /** 申请未提货全额模拟退款。 */
  Response<AfterSaleResponseDTO> requestRefund(
    String orderId,
    RefundRequestDTO request,
    Principal principal
  );
  /** 对商户驳回发起平台争议。 */
  Response<Void> appeal(String orderId, Principal principal);
  /** 商户售后列表。 */
  Response<List<AfterSaleResponseDTO>> merchantAfterSales(
    String merchantId,
    String state,
    int page,
    int size,
    Principal principal
  );
  Response<PageResponseDTO<AfterSaleResponseDTO>> merchantAfterSalesPage(
    String merchantId,
    String state,
    int page,
    int size,
    Principal principal
  );
  /** 商户审核退款；进入争议后只允许平台处理。 */
  Response<Void> merchantDecide(
    String merchantId,
    String orderId,
    ReviewRequestDTO request,
    Principal principal
  );
  /** 平台争议及售后列表。 */
  Response<List<AfterSaleResponseDTO>> platformAfterSales(
    String state,
    int page,
    int size,
    Principal principal
  );
  Response<PageResponseDTO<AfterSaleResponseDTO>> platformAfterSalesPage(
    String state,
    int page,
    int size,
    Principal principal
  );
  /** 平台有审计的退款裁决。 */
  Response<Void> platformDecide(String orderId, ReviewRequestDTO request, Principal principal);
}
