package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IInventoryApi;
import cn.bugstack.ai.api.dto.PageResponseDTO;
import cn.bugstack.ai.api.dto.ReplenishRequestDTO;
import cn.bugstack.ai.api.dto.StockMovementResponseDTO;
import cn.bugstack.ai.api.dto.StockResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
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
public class InventoryController implements IInventoryApi {

    @Resource
    private ICatalogCase catalogCase;

    /** 商户库存三量查询。 */
    @Override
    @GetMapping("/merchants/{merchantId}/stocks")
    public Response<List<StockResponseDTO>> stocks(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return catalogCase.stocks(actor(principal), merchantId, page, size).stream().map(ApiViews::stock).toList();
        });
    }

    @Override
    @GetMapping("/merchants/{merchantId}/stocks/page")
    public Response<PageResponseDTO<StockResponseDTO>> stocksPage(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String q,
        Principal principal
    ) {
        return execute(() -> {
            String who = actor(principal);
            List<StockVO> rows = catalogCase.stocks(who, merchantId, page, size, q);
            Map<String, SkuOfferVO> offers = catalogCase.stockOffers(who, merchantId, rows.stream().map(StockVO::skuId).toList());
            var items = rows
                .stream()
                .map(s -> {
                    var dto = ApiViews.stock(s);
                    var offer = offers.get(s.skuId());
                    if (offer != null) {
                        dto.setProductId(offer.productId());
                        dto.setProductTitle(offer.title());
                        dto.setSpecKey(offer.specKey());
                        dto.setImageUrl(offer.imageUrl());
                    }
                    return dto;
                })
                .toList();
            return PageResponseDTO.of(items, page, size, catalogCase.countStocks(who, merchantId, q));
        });
    }

    /** 按请求键幂等补货。 */
    @Override
    @PostMapping("/merchants/{merchantId}/stocks/{skuId}/replenish")
    public Response<Void> replenish(
        @PathVariable("merchantId") String merchantId,
        @PathVariable("skuId") String skuId,
        @RequestBody ReplenishRequestDTO request,
        @RequestHeader(value = "Idempotency-Key", required = false) String key,
        Principal principal
    ) {
        return execute(() -> {
            catalogCase.replenish(actor(principal), merchantId, skuId, required(required(request).getQuantity()), key);
            return null;
        });
    }

    /** 本商户库存流水。 */
    @Override
    @GetMapping("/merchants/{merchantId}/stock-movements")
    public Response<List<StockMovementResponseDTO>> movements(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return catalogCase
                .movements(actor(principal), merchantId, page, size)
                .stream()
                .map(m ->
                    StockMovementResponseDTO.builder()
                        .id(m.id())
                        .skuId(m.skuId())
                        .type(m.type())
                        .quantity(m.quantity())
                        .bizKey(m.bizKey())
                        .createdAt(m.createdAt())
                        .build()
                )
                .toList();
        });
    }

    @Override
    @GetMapping("/merchants/{merchantId}/stock-movements/page")
    public Response<PageResponseDTO<StockMovementResponseDTO>> movementsPage(
        @PathVariable("merchantId") String merchantId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() ->
            PageResponseDTO.of(
                catalogCase
                    .movements(actor(principal), merchantId, page, size)
                    .stream()
                    .map(m ->
                        StockMovementResponseDTO.builder()
                            .id(m.id())
                            .skuId(m.skuId())
                            .type(m.type())
                            .quantity(m.quantity())
                            .bizKey(m.bizKey())
                            .createdAt(m.createdAt())
                            .build()
                    )
                    .toList(),
                page,
                size,
                catalogCase.countMovements(actor(principal), merchantId)
            )
        );
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
