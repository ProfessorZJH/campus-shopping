package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.actor;
import static cn.bugstack.ai.trigger.http.RequestInputs.required;

import cn.bugstack.ai.api.ICartApi;
import cn.bugstack.ai.api.dto.CartResponseDTO;
import cn.bugstack.ai.api.dto.CartSetRequestDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.cases.trading.ICartQueryCase;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class CartController implements ICartApi {

    @Resource
    private ICartCase cartCase;

    @Resource
    private ICartQueryCase cartQuery;

    /** 本人购物车，展示实时价格与可售状态。 */
    @Override
    @GetMapping("/cart")
    public Response<List<CartResponseDTO>> cart(Principal principal) {
        return execute(() -> cartQuery.list(actor(principal)).stream().map(ApiViews::cart).toList());
    }

    /** 设置本人购物车数量。 */
    @Override
    @PutMapping("/cart")
    public Response<Void> set(@RequestBody CartSetRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);
            cartCase.set(actor(principal), request.getSkuId(), required(request.getQuantity()));
            return null;
        });
    }

    /** 移除本人购物车商品。 */
    @Override
    @DeleteMapping("/cart/{skuId}")
    public Response<Void> delete(@PathVariable("skuId") String skuId, Principal principal) {
        return execute(() -> {
            cartCase.delete(actor(principal), skuId);
            return null;
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
