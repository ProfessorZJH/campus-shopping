package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.IAfterSaleApi;
import cn.bugstack.ai.api.dto.*;import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.exception.AppException;
import cn.bugstack.ai.domain.identity.service.*;import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.domain.catalog.service.*;import cn.bugstack.ai.domain.inventory.service.*;import cn.bugstack.ai.domain.afterSales.service.*;import cn.bugstack.ai.domain.fulfillment.service.*;
import cn.bugstack.ai.cases.merchant.*;import cn.bugstack.ai.cases.catalog.*;import cn.bugstack.ai.cases.afterSales.*;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;import cn.bugstack.ai.domain.catalog.model.entity.*;import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.domain.inventory.model.valobj.*;import cn.bugstack.ai.domain.afterSales.model.entity.*;import cn.bugstack.ai.domain.afterSales.model.valobj.*;import cn.bugstack.ai.domain.afterSales.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import static cn.bugstack.ai.trigger.http.RequestInputs.*;import static cn.bugstack.ai.types.common.Checks.require;
import jakarta.annotation.Resource;import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;import java.util.*;import java.util.function.Supplier;import java.util.stream.Collectors;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class AfterSaleController implements IAfterSaleApi {
    @Resource private IOrderLifecycleCase lifecycle;
    @Resource private IAfterSaleService afterSales;
    @Resource private IAccessService access;

    /** 申请未提货全额模拟退款。 */
    @Override
    @PostMapping("/orders/{orderId}/refunds")
    public Response<AfterSaleResponseDTO> requestRefund(@PathVariable("orderId") String orderId, @RequestBody RefundRequestDTO request, Principal principal) {
        return execute(() -> {
            return ApiViews.afterSale(lifecycle.requestRefund(actor(principal),orderId,required(request).getReason()));
        });
    }

    /** 对商户驳回发起平台争议。 */
    @Override
    @PostMapping("/orders/{orderId}/appeal")
    public Response<Void> appeal(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.appeal(actor(principal),orderId);return null;
        });
    }

    /** 商户售后列表。 */
    @Override
    @GetMapping("/merchants/{merchantId}/aftersales")
    public Response<List<AfterSaleResponseDTO>> merchantAfterSales(@PathVariable("merchantId") String merchantId, @RequestParam(required=false) String state, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            access.requirePermission(actor(principal),merchantId,"aftersale.read");return afterSales.afterSales(null,merchantId,state,page,size).stream().map(ApiViews::afterSale).toList();
        });
    }

    @Override @GetMapping("/merchants/{merchantId}/aftersales/page")
    public Response<PageResponseDTO<AfterSaleResponseDTO>> merchantAfterSalesPage(@PathVariable("merchantId") String merchantId,@RequestParam(required=false) String state,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->{access.requirePermission(actor(principal),merchantId,"aftersale.read");return PageResponseDTO.of(afterSales.afterSales(null,merchantId,state,page,size).stream().map(ApiViews::afterSale).toList(),page,size,afterSales.countAfterSales(null,merchantId,state));});
    }

    /** 商户审核退款；进入争议后只允许平台处理。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/refund-decision")
    public Response<Void> merchantDecide(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, @RequestBody ReviewRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);lifecycle.decideRefund(actor(principal),merchantId,orderId,required(request.getApproved()),request.getReason(),false);return null;
        });
    }

    /** 平台争议及售后列表。 */
    @Override
    @GetMapping("/admin/aftersales")
    public Response<List<AfterSaleResponseDTO>> platformAfterSales(@RequestParam(required=false) String state, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            access.requireAdmin(actor(principal));return afterSales.afterSales(null,null,state,page,size).stream().map(ApiViews::afterSale).toList();
        });
    }

    /** 平台有审计的退款裁决。 */
    @Override
    @PostMapping("/admin/orders/{orderId}/refund-decision")
    public Response<Void> platformDecide(@PathVariable("orderId") String orderId, @RequestBody ReviewRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);lifecycle.decideRefund(actor(principal),null,orderId,required(request.getApproved()),request.getReason(),true);return null;
        });
    }

    @Override @GetMapping("/admin/aftersales/page")
    public Response<PageResponseDTO<AfterSaleResponseDTO>> platformAfterSalesPage(@RequestParam(required=false) String state,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->{access.requireAdmin(actor(principal));return PageResponseDTO.of(afterSales.afterSales(null,null,state,page,size).stream().map(ApiViews::afterSale).toList(),page,size,afterSales.countAfterSales(null,null,state));});
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
