package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.ICartApi;
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
public class CartController implements ICartApi {
    @Resource private ICartCase cartCase;
    @Resource private ICatalogService catalog;
    @Resource private IInventoryService inventory;
    @Resource private IMerchantService merchants;

    /** 本人购物车，展示实时价格与可售状态。 */
    @Override
    @GetMapping("/cart")
    public Response<List<CartResponseDTO>> cart(Principal principal) {
        return execute(() -> {
            var items=cartCase.list(actor(principal));var offers=catalog.offers(items.stream().map(CartItemVO::skuId).toList(),false,false).stream().collect(Collectors.toMap(SkuOfferVO::skuId,o->o));
            var stocks=inventory.stocks(items.stream().map(CartItemVO::skuId).toList()).stream().collect(Collectors.toMap(StockVO::skuId,s->s));Map<String,cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO> merchantCache=new HashMap<>();List<CartResponseDTO> result=new ArrayList<>();
            for(var item:items){var offer=offers.get(item.skuId());var stock=stocks.get(item.skuId());var merchant=merchantCache.computeIfAbsent(item.merchantId(),merchants::find);boolean merchantActive="ACTIVE".equals(merchant.status());result.add(CartResponseDTO.builder().merchantId(item.merchantId()).merchantName(merchant.name()).skuId(item.skuId()).title(offer.title()).specKey(offer.specKey()).imageUrl(offer.imageUrl()).priceCent(offer.priceCent()).quoteVersion(offer.version()).quantity(item.quantity()).available(stock==null?0:stock.onHand()-stock.reserved()).sellable(merchantActive&&"PUBLISHED".equals(offer.productStatus())&&"ACTIVE".equals(offer.skuStatus())).build());}return result;
        });
    }

    /** 设置本人购物车数量。 */
    @Override
    @PutMapping("/cart")
    public Response<Void> set(@RequestBody CartSetRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);cartCase.set(actor(principal),request.getSkuId(),required(request.getQuantity()));return null;
        });
    }

    /** 移除本人购物车商品。 */
    @Override
    @DeleteMapping("/cart/{skuId}")
    public Response<Void> delete(@PathVariable("skuId") String skuId, Principal principal) {
        return execute(() -> {
            cartCase.delete(actor(principal),skuId);return null;
        });
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
