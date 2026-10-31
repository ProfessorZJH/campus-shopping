package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IFulfillmentApi;
import cn.bugstack.ai.api.dto.OrderResponseDTO;
import cn.bugstack.ai.api.dto.TokenResponseDTO;
import cn.bugstack.ai.api.dto.VerifyPickupRequestDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class FulfillmentController implements IFulfillmentApi {

    @Resource
    private IOrderLifecycleCase lifecycle;

    /** 开始备货。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/prepare")
    public Response<Void> prepare(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.startPreparing(actor(principal), merchantId, orderId);
            return null;
        });
    }

    /** 备货完成。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/ready")
    public Response<Void> ready(@PathVariable("merchantId") String merchantId, @PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            lifecycle.markReady(actor(principal), merchantId, orderId);
            return null;
        });
    }

    /** 本人领取或重新签发自提凭证，旧凭证立即失效。 */
    @Override
    @PostMapping("/orders/{orderId}/pickup-token")
    public Response<TokenResponseDTO> token(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            var token = lifecycle.issuePickupToken(actor(principal), orderId);
            return TokenResponseDTO.builder().token(token.token()).expiresAt(token.expiresAt()).build();
        });
    }

    /** 店员单次核销，订单完成和库存出库原子提交。 */
    @Override
    @PostMapping("/merchants/{merchantId}/orders/{orderId}/verify")
    public Response<OrderResponseDTO> verify(
        @PathVariable("merchantId") String merchantId,
        @PathVariable("orderId") String orderId,
        @RequestBody VerifyPickupRequestDTO request,
        Principal principal
    ) {
        return execute(() -> {
            var o = lifecycle.verifyPickup(actor(principal), merchantId, orderId, required(request).getToken());
            return ApiViews.order(o);
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
