package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;

import cn.bugstack.ai.api.IAfterSaleApi;
import cn.bugstack.ai.api.dto.AfterSaleResponseDTO;
import cn.bugstack.ai.api.dto.PageResponseDTO;
import cn.bugstack.ai.api.dto.RefundRequestDTO;
import cn.bugstack.ai.api.dto.ReviewRequestDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class AfterSaleController implements IAfterSaleApi {

    @Resource
    private IOrderLifecycleCase lifecycle;

    @Resource
    private IOrderQueryCase query;

    /** 申请未提货全额模拟退款。 */
    @Override
    @PostMapping("/orders/{orderId}/refunds")
    public Response<AfterSaleResponseDTO> requestRefund(@PathVariable("orderId") String orderId, @RequestBody RefundRequestDTO request, Principal principal) {
        return execute(() -> {
            return ApiViews.afterSale(lifecycle.requestRefund(actor(principal), orderId, required(request).getReason()));
        });
    }

    /** 对商户驳回发起平台争议。 */
    @Override
    @PostMapping("/orders/{orderId}/appeal")
    public Response<Void> appeal(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.appeal(actor(principal), orderId);
            return null;
        });
    }

    /** 商户售后列表。 */
    @Override
    @GetMapping("/merchants/{merchantId}/aftersales")
    public Response<List<AfterSaleResponseDTO>> merchantAfterSales(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return query.merchantAfterSales(actor(principal), merchantId, state, page, size).stream().map(ApiViews::afterSale).toList();
        });
    }

    @Override
    @GetMapping("/merchants/{merchantId}/aftersales/page")
    public Response<PageResponseDTO<AfterSaleResponseDTO>> merchantAfterSalesPage(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return PageResponseDTO.of(
                query.merchantAfterSales(actor(principal), merchantId, state, page, size).stream().map(ApiViews::afterSale).toList(),
                page,
                size,
                query.countMerchantAfterSales(actor(principal), merchantId, state)
            );
        });
    }

    /** 商户审核退款；进入争议后只允许平台处理。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/refund-decision")
    public Response<Void> merchantDecide(
        @PathVariable("merchantId") String merchantId,
        @PathVariable("orderId") String orderId,
        @RequestBody ReviewRequestDTO request,
        Principal principal
    ) {
        return execute(() -> {
            required(request);
            if (required(request.getApproved())) lifecycle.merchantApproveRefund(actor(principal), merchantId, orderId, request.getReason());
            else lifecycle.merchantRejectRefund(actor(principal), merchantId, orderId, request.getReason());
            return null;
        });
    }

    /** 平台争议及售后列表。 */
    @Override
    @GetMapping("/admin/aftersales")
    public Response<List<AfterSaleResponseDTO>> platformAfterSales(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return query.platformAfterSales(actor(principal), state, page, size).stream().map(ApiViews::afterSale).toList();
        });
    }

    /** 平台有审计的退款裁决。 */
    @Override
    @PostMapping("/admin/orders/{orderId}/refund-decision")
    public Response<Void> platformDecide(@PathVariable("orderId") String orderId, @RequestBody ReviewRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);
            if (required(request.getApproved())) lifecycle.platformApproveRefund(actor(principal), orderId, request.getReason());
            else lifecycle.platformRejectRefund(actor(principal), orderId, request.getReason());
            return null;
        });
    }

    @Override
    @GetMapping("/admin/aftersales/page")
    public Response<PageResponseDTO<AfterSaleResponseDTO>> platformAfterSalesPage(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return PageResponseDTO.of(
                query.platformAfterSales(actor(principal), state, page, size).stream().map(ApiViews::afterSale).toList(),
                page,
                size,
                query.countPlatformAfterSales(actor(principal), state)
            );
        });
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try {
            return ApiResponses.success(action.get());
        } catch (AppException e) {
            ControllerFailures.record(log, e);
            return ApiResponses.rejected(e);
        } catch (Exception e) {
            ControllerFailures.unexpected(log, e);
            return ApiResponses.unexpected();
        }
    }
}
