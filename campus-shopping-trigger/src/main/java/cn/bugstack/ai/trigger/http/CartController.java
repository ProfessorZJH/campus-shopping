package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.ICartApi;
import cn.bugstack.ai.api.dto.CartResponseDTO;
import cn.bugstack.ai.api.dto.CartSetRequestDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
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
public class CartController implements ICartApi {

    @Resource
    private ICartCase cartCase;

    @Resource
    private ICatalogService catalog;

    @Resource
    private IInventoryService inventory;

    @Resource
    private IMerchantService merchants;

    /** 本人购物车，展示实时价格与可售状态。 */
    @Override
    @GetMapping("/cart")
    public Response<List<CartResponseDTO>> cart(Principal principal) {
        return execute(() -> {
            var items = cartCase.list(actor(principal));
            var offers = catalog
                .offers(items.stream().map(CartItemVO::skuId).toList(), false, false)
                .stream()
                .collect(Collectors.toMap(SkuOfferVO::skuId, o -> o));
            var stocks = inventory
                .stocks(items.stream().map(CartItemVO::skuId).toList())
                .stream()
                .collect(Collectors.toMap(StockVO::skuId, s -> s));
            Map<String, cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO> merchantCache = new HashMap<>();
            List<CartResponseDTO> result = new ArrayList<>();
            for (var item : items) {
                var offer = offers.get(item.skuId());
                var stock = stocks.get(item.skuId());
                var merchant = merchantCache.computeIfAbsent(item.merchantId(), merchants::find);
                boolean merchantActive = "ACTIVE".equals(merchant.status());
                result.add(
                    CartResponseDTO.builder()
                        .merchantId(item.merchantId())
                        .merchantName(merchant.name())
                        .skuId(item.skuId())
                        .title(offer.title())
                        .specKey(offer.specKey())
                        .imageUrl(offer.imageUrl())
                        .priceCent(offer.priceCent())
                        .quoteVersion(offer.version())
                        .quantity(item.quantity())
                        .available(stock == null ? 0 : stock.onHand() - stock.reserved())
                        .sellable(merchantActive && "PUBLISHED".equals(offer.productStatus()) && "ACTIVE".equals(offer.skuStatus()))
                        .build()
                );
            }
            return result;
        });
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
