package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.IOrderApi;
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
public class OrderController implements IOrderApi {
    @Resource private ICheckoutCase checkoutCase;
    @Resource private IOrderLifecycleCase lifecycle;
    @Resource private ITradingService trading;
    @Resource private IFulfillmentService fulfillment;

    @Resource private IMerchantService merchants;    @Resource private IAccessService access;

    /** 核价、预占、建单、清理购物车同事务。 */
    @Override
    @PostMapping("/orders")
    public Response<OrderResponseDTO> checkout(@RequestBody CheckoutRequestDTO request, @RequestHeader(value="Idempotency-Key",required=false) String key, Principal principal) {
        return execute(() -> {
            required(request);required(request.getItems());List<CheckoutItemEntity> items=request.getItems().stream().map(i->new CheckoutItemEntity(required(i).getSkuId(),required(i.getQuantity()),required(i.getExpectedPriceCent()),required(i.getExpectedVersion()))).toList();return view(checkoutCase.checkout(actor(principal),request.getMerchantId(),items,key));
        });
    }

    /** 本人订单列表。 */
    @Override
    @GetMapping("/orders")
    public Response<List<OrderResponseDTO>> mine(@RequestParam(required=false) String state, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            return trading.orders(actor(principal),null,state,page,size).stream().map(this::view).toList();
        });
    }

    @Override @GetMapping("/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> minePage(@RequestParam(required=false) String state,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->{String buyer=actor(principal);return PageResponseDTO.of(views(trading.orders(buyer,null,state,page,size)),page,size,trading.countOrders(buyer,null,state));});
    }

    /** 本人、当前商户成员或平台管理员可查订单详情。 */
    @Override
    @GetMapping("/orders/{orderId}")
    public Response<OrderResponseDTO> detail(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            OrderAggregate o=trading.order(orderId,false);String user=actor(principal);if(!user.equals(o.getBuyerId())&&!access.isAdmin(user))access.requirePermission(user,o.getMerchantId(),"order.read");return view(o);
        });
    }

    /** 商户待处理订单。 */
    @Override
    @GetMapping("/merchants/{merchantId}/orders")
    public Response<List<OrderResponseDTO>> merchantOrders(@PathVariable("merchantId") String merchantId, @RequestParam(required=false) String state, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            access.requirePermission(actor(principal),merchantId,"order.read");return trading.orders(null,merchantId,state,page,size).stream().map(this::view).toList();
        });
    }

    @Override @GetMapping("/merchants/{merchantId}/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> merchantOrdersPage(@PathVariable("merchantId") String merchantId,@RequestParam(required=false) String state,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String q,Principal principal){
        return execute(()->{access.requirePermission(actor(principal),merchantId,"order.read");return PageResponseDTO.of(views(trading.orders(null,merchantId,state,page,size,q)),page,size,trading.countOrders(null,merchantId,state,q));});
    }

    /** 本人模拟支付，不产生真实资金。 */
    @Override
    @PostMapping("/orders/{orderId}/pay")
    public Response<OrderResponseDTO> pay(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            return view(lifecycle.pay(actor(principal),orderId));
        });
    }

    /** 取消本人未付款订单并释放预占。 */
    @Override
    @PostMapping("/orders/{orderId}/cancel")
    public Response<OrderResponseDTO> cancel(@PathVariable("orderId") String orderId, Principal principal) {
        return execute(() -> {
            return view(lifecycle.cancel(actor(principal),orderId));
        });
    }

    /** Owner 经营统计。 */
    @Override
    @GetMapping("/merchants/{merchantId}/statistics")
    public Response<StatisticsResponseDTO> merchantStatistics(@PathVariable("merchantId") String merchantId, Principal principal) {
        return execute(() -> {
            access.requirePermission(actor(principal),merchantId,"dashboard.read");return ApiViews.statistics(trading.statistics(merchantId));
        });
    }

    /** 平台订单汇总。 */
    @Override
    @GetMapping("/admin/statistics")
    public Response<StatisticsResponseDTO> platformStatistics(Principal principal) {
        return execute(() -> {
            access.requireAdmin(actor(principal));return ApiViews.statistics(trading.statistics(null));
        });
    }

    /** 平台受控订单监管。 */
    @Override
    @GetMapping("/admin/orders")
    public Response<List<OrderResponseDTO>> platformOrders(@RequestParam(required=false) String state, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            access.requireAdmin(actor(principal));return trading.orders(null,null,state,page,size).stream().map(this::view).toList();
        });
    }
    @Override @GetMapping("/admin/orders/page")
    public Response<PageResponseDTO<OrderResponseDTO>> platformOrdersPage(@RequestParam(required=false) String state,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String q,Principal principal){
        return execute(()->{access.requireAdmin(actor(principal));return PageResponseDTO.of(views(trading.orders(null,null,state,page,size,q)),page,size,trading.countOrders(null,null,state,q));});
    }
    /** 每页商户名称按 merchantId 缓存，避免为每笔订单重复查询。 */
    private List<OrderResponseDTO> views(List<OrderAggregate> orders){Map<String,String> names=new HashMap<>();return orders.stream().map(o->{OrderResponseDTO dto=ApiViews.order(o,fulfillment.pickup(o.getId(),false),trading.afterSale(o.getId(),false));dto.setMerchantName(names.computeIfAbsent(o.getMerchantId(),m->merchants.find(m).name()));return dto;}).toList();}
    private OrderResponseDTO view(OrderAggregate o){OrderResponseDTO dto=ApiViews.order(o,fulfillment.pickup(o.getId(),false),trading.afterSale(o.getId(),false));dto.setMerchantName(merchants.find(o.getMerchantId()).name());return dto;}
    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
