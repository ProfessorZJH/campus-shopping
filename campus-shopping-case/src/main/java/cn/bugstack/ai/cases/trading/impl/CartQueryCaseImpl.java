package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.cases.trading.ICartQueryCase;
import cn.bugstack.ai.cases.trading.model.CartItemReadModel;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantStatusEnumVO;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 先检查当前账号，再一次性取得报价、库存与商户，避免每行额外查库。 */
@Service
@Transactional(readOnly = true)
public class CartQueryCaseImpl implements ICartQueryCase {

    private final ICartCase cartCase;
    private final ICatalogService catalogService;
    private final IInventoryService inventoryService;
    private final IMerchantService merchantService;

    public CartQueryCaseImpl(ICartCase cartCase, ICatalogService catalogService, IInventoryService inventoryService, IMerchantService merchantService) {
        this.cartCase = cartCase;
        this.catalogService = catalogService;
        this.inventoryService = inventoryService;
        this.merchantService = merchantService;
    }

    public List<CartItemReadModel> list(String actor) {
        List<CartItemVO> items = cartCase.list(actor);
        if (items.isEmpty()) return List.of();
        List<String> skuIds = items.stream().map(CartItemVO::skuId).distinct().toList();
        Map<String, SkuOfferVO> offers = catalogService
            .offers(skuIds, false, false)
            .stream()
            .collect(Collectors.toMap(SkuOfferVO::skuId, offer -> offer));
        Map<String, StockVO> stocks = inventoryService
            .stocks(skuIds)
            .stream()
            .collect(Collectors.toMap(StockVO::skuId, stock -> stock));
        Map<String, MerchantVO> merchants = merchantService
            .findAll(items.stream().map(CartItemVO::merchantId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(MerchantVO::id, merchant -> merchant));
        return items
            .stream()
            .map(item -> {
                SkuOfferVO offer = offers.get(item.skuId());
                MerchantVO merchant = merchants.get(item.merchantId());
                if (offer == null || merchant == null || !item.merchantId().equals(offer.merchantId())) {
                    throw new IllegalStateException("购物车商品或商户关联不一致");
                }
                StockVO stock = stocks.get(item.skuId());
                boolean sellable =
                    merchant.state() == MerchantStatusEnumVO.ACTIVE &&
                    offer.productStatusEnum() == ProductStatusEnumVO.PUBLISHED &&
                    offer.skuStatusEnum() == SkuStatusEnumVO.ACTIVE;
                return new CartItemReadModel(item, offer, merchant.name(), stock == null ? 0L : stock.onHand() - stock.reserved(), sellable);
            })
            .toList();
    }
}
