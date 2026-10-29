package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.IFulfillmentApi;
import cn.bugstack.ai.api.dto.*;import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.exception.AppException;
import cn.bugstack.ai.domain.identity.service.*;import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.domain.catalog.service.*;import cn.bugstack.ai.domain.inventory.service.*;import cn.bugstack.ai.domain.trading.service.*;import cn.bugstack.ai.domain.fulfillment.service.*;
import cn.bugstack.ai.cases.merchant.*;import cn.bugstack.ai.cases.catalog.*;import cn.bugstack.ai.cases.trading.*;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;import cn.bugstack.ai.domain.catalog.model.entity.*;import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.domain.inventory.model.valobj.*;import cn.bugstack.ai.domain.trading.model.entity.*;import cn.bugstack.ai.domain.trading.model.valobj.*;import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import static cn.bugstack.ai.trigger.http.RequestInputs.*;import static cn.bugstack.ai.types.common.Checks.require;
import jakarta.annotation.Resource;import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;import java.util.*;import java.util.function.Supplier;import java.util.stream.Collectors;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class FulfillmentController implements IFulfillmentApi {
    @Resource private IOrderLifecycleCase lifecycle;
    @Resource private IFulfillmentService fulfillment;
    @Resource private IAfterSaleService afterSales;

    /** 开始备货。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/prepare")
    public Response<Void> prepare(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.prepare(actor(principal),merchantId,orderId,false);return null;
        });
    }

    /** 备货完成。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/ready")
    public Response<Void> ready(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.prepare(actor(principal),merchantId,orderId,true);return null;
        });
    }

    /** 本人领取或重新签发自提凭证，旧凭证立即失效。 */
    @Override
    @PostMapping("/orders/{orderId}/pickup-token")
    public Response<TokenResponseDTO> token(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            var token=lifecycle.token(actor(principal),orderId);return TokenResponseDTO.builder().token(token.token()).expiresAt(token.expiresAt()).build();
        });
    }

    /** 店员单次核销，订单完成和库存出库原子提交。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/verify")
    public Response<OrderResponseDTO> verify(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, @RequestBody VerifyPickupRequestDTO request, Principal principal) {
        return execute(() -> {
            var o=lifecycle.verify(actor(principal),merchantId,orderId,required(request).getToken());return ApiViews.order(o,fulfillment.pickup(orderId,false),afterSales.afterSale(orderId,false));
        });
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
