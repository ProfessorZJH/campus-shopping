package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IOrderApi;
import cn.bugstack.ai.api.dto.CheckoutRequestDTO;
import cn.bugstack.ai.api.dto.OrderResponseDTO;
import cn.bugstack.ai.api.dto.PageResponseDTO;
import cn.bugstack.ai.api.dto.StatisticsResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.trading.ICheckoutCase;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
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
public class OrderController implements IOrderApi {

    @Resource
    private ICheckoutCase checkoutCase;

    @Resource
    private IOrderLifecycleCase lifecycle;

    @Resource
    private IOrderQueryCase query;

    /** 核价、预占、建单、清理购物车同事务。 */
    @Override
    @PostMapping("/orders")
    public Response<OrderResponseDTO> checkout(
        @RequestBody CheckoutRequestDTO request,
        @RequestHeader(value = "Idempotency-Key", required = false) String key,
        Principal principal
    ) {
        return execute(() -> {
            required(request);
            required(request.getItems());
            List<CheckoutItemEntity> items = request
                .getItems()
                .stream()
                .map(i ->
                    new CheckoutItemEntity(
                        required(i).getSkuId(),
                        required(i.getQuantity()),
                        required(i.getExpectedPriceCent()),
                        required(i.getExpectedVersion())
                    )
                )
                .toList();
            return readView(checkoutCase.checkout(actor(principal), request.getMerchantId(), items, key));
        });
    }

    /** 本人订单列表。 */
    @Override
    @GetMapping("/orders")
    public Response<List<OrderResponseDTO>> mine(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> query.mine(actor(principal), state, page, size).items().stream().map(this::readView).toList());
    }

    @Override
    @GetMapping("/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> minePage(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            var result = query.mine(actor(principal), state, page, size);
            return PageResponseDTO.of(result.items().stream().map(this::readView).toList(), page, size, result.total());
        });
    }

    /** 本人、当前商户成员或平台管理员可查订单详情。 */
    @Override
    @GetMapping("/orders/{orderId}")
    public Response<OrderResponseDTO> detail(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> readView(query.detail(actor(principal), orderId)));
    }

    /** 商户待处理订单。 */
    @Override
    @GetMapping("/merchants/{merchantId}/orders")
    public Response<List<OrderResponseDTO>> merchantOrders(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> query.merchant(actor(principal), merchantId, state, page, size, "").items().stream().map(this::readView).toList());
    }

    @Override
    @GetMapping("/merchants/{merchantId}/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> merchantOrdersPage(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String q,
        Principal principal
    ) {
        return execute(() -> {
            var result = query.merchant(actor(principal), merchantId, state, page, size, q);
            return PageResponseDTO.of(result.items().stream().map(this::readView).toList(), page, size, result.total());
        });
    }

    /** 本人模拟支付，不产生真实资金。 */
    @Override
    @PostMapping("/orders/{orderId}/pay")
    public Response<OrderResponseDTO> pay(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            return readView(lifecycle.pay(actor(principal), orderId));
        });
    }

    /** 取消本人未付款订单并释放预占。 */
    @Override
    @PostMapping("/orders/{orderId}/cancel")
    public Response<OrderResponseDTO> cancel(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            return readView(lifecycle.cancel(actor(principal), orderId));
        });
    }

    /** Owner 经营统计。 */
    @Override
    @GetMapping("/merchants/{merchantId}/statistics")
    public Response<StatisticsResponseDTO> merchantStatistics(@PathVariable("merchantId") String merchantId, Principal principal) {
        return execute(() -> ApiViews.statistics(query.statistics(actor(principal), merchantId)));
    }

    /** 平台订单汇总。 */
    @Override
    @GetMapping("/admin/statistics")
    public Response<StatisticsResponseDTO> platformStatistics(Principal principal) {
        return execute(() -> ApiViews.statistics(query.statistics(actor(principal), null)));
    }

    /** 平台受控订单监管。 */
    @Override
    @GetMapping("/admin/orders")
    public Response<List<OrderResponseDTO>> platformOrders(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> query.platform(actor(principal), state, page, size, "").items().stream().map(this::readView).toList());
    }

    @Override
    @GetMapping("/admin/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> platformOrdersPage(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String q,
        Principal principal
    ) {
        return execute(() -> {
            var result = query.platform(actor(principal), state, page, size, q);
            return PageResponseDTO.of(result.items().stream().map(this::readView).toList(), page, size, result.total());
        });
    }

    private OrderResponseDTO readView(cn.bugstack.ai.cases.trading.model.OrderReadModel model) {
        return ApiViews.order(model);
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
