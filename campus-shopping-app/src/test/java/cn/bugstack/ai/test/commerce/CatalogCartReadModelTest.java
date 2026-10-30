package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.impl.CatalogQueryCaseImpl;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.merchant.impl.WorkspaceQueryCaseImpl;
import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.cases.trading.impl.CartQueryCaseImpl;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.trigger.http.ApiViews;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CatalogCartReadModelTest {

    private final ICatalogCase products = mock(ICatalogCase.class);
    private final ICartCase cart = mock(ICartCase.class);
    private final ICatalogService catalog = mock(ICatalogService.class);
    private final IInventoryService inventory = mock(IInventoryService.class);
    private final IMerchantService merchants = mock(IMerchantService.class);

    private MerchantVO merchant(String id, String state) {
        return new MerchantVO(id, null, "商户" + id, "文具", state, "store", "门店", "校园");
    }

    @Test
    void orderMappingRequiresMerchantNameAndKeepsHistoricalItemSnapshot() {
        var created = Instant.parse("2026-10-30T00:00:00Z");
        var order = new OrderAggregate(
            "order",
            "buyer",
            "merchant",
            "store",
            List.of(new OrderItemEntity("sku", "成交时商品名", "原规格", 1200, 2, "/media/a.png")),
            "PAID",
            created.plusSeconds(900),
            created
        );
        assertThrows(NullPointerException.class, () -> new OrderReadModel(order, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new OrderReadModel(order, " ", null, null));
        var dto = ApiViews.order(new OrderReadModel(order, "商户", null, null));
        assertEquals("商户", dto.getMerchantName());
        assertEquals(2400, dto.getTotalCent());
        assertEquals("/media/a.png", dto.getItems().get(0).getImageUrl());
        assertEquals("成交时商品名", dto.getItems().get(0).getTitle());
    }

    @Test
    void productReadModelRejectsIncompleteRequiredFacts() {
        var product = new ProductAggregate(
            "p",
            "m",
            "store",
            "商品",
            "",
            "stationery",
            "",
            "PUBLISHED",
            0,
            List.of(new ProductSkuEntity("s", "默认", 100, "ACTIVE", 0))
        );
        assertThrows(IllegalArgumentException.class, () -> new ProductReadModel(product, "商户", Map.of()));
        assertThrows(IllegalArgumentException.class, () -> new ProductReadModel(product, "  ", Map.of("s", 0L)));
        var dto = ApiViews.product(ProductReadModel.from(product, "商户", Map.of()));
        assertEquals(0L, dto.getSkus().get(0).getAvailable());
        assertEquals("商户", dto.getMerchantName());
    }

    @Test
    void hundredDistinctMerchantsAreReadOnceAndEveryDtoIsComplete() {
        var rows = new ArrayList<ProductAggregate>();
        var shops = new ArrayList<MerchantVO>();
        for (int i = 0; i < 100; i++) {
            rows.add(
                new ProductAggregate(
                    "p" + i,
                    "m" + i,
                    "store",
                    "商品",
                    "",
                    "stationery",
                    "",
                    "PUBLISHED",
                    0,
                    List.of(new ProductSkuEntity("s" + i, "默认", 100, "ACTIVE", 0))
                )
            );
            shops.add(merchant("m" + i, "ACTIVE"));
        }
        when(products.publicProducts(null, "", null, 1, 100)).thenReturn(rows);
        var ids = rows.stream().map(ProductAggregate::getMerchantId).toList();
        when(merchants.findAll(ids)).thenReturn(shops);
        var query = new CatalogQueryCaseImpl(products, catalog, inventory, merchants);
        var result = query.publicProducts(null, "", null, 1, 100).stream().map(ApiViews::product).toList();
        assertEquals(100, result.size());
        for (int i = 0; i < 100; i++) assertEquals("商户m" + i, result.get(i).getMerchantName());
        verify(merchants).findAll(ids);
        verify(merchants, never()).find(anyString());
        verify(inventory).stocks(anyList());
    }

    @Test
    void deniedAndEmptyProductPagesDoNotReadEnrichment() {
        when(products.managedProducts("u", "m", 1, 20)).thenThrow(new AppException(ResponseCode.AUTH_FORBIDDEN));
        var query = new CatalogQueryCaseImpl(products, catalog, inventory, merchants);
        assertThrows(AppException.class, () -> query.managedProducts("u", "m", 1, 20));
        assertTrue(query.publicProducts(null, "", null, 1, 20).isEmpty());
        verifyNoInteractions(inventory, merchants);
    }

    @Test
    void cartUsesBatchFactsAndPreservesUnavailableRows() {
        when(cart.list("u")).thenReturn(List.of(new CartItemVO("u", "m1", "s1", 2), new CartItemVO("u", "m2", "s2", 1), new CartItemVO("u", "m1", "s3", 1)));
        when(catalog.offers(List.of("s1", "s2", "s3"))).thenReturn(
            List.of(
                new SkuOfferVO("s1", "p1", "m1", "store", "商品1", "默认", 100, 2, "PUBLISHED", "ACTIVE", "", ""),
                new SkuOfferVO("s2", "p2", "m2", "store", "商品2", "默认", 200, 3, "PUBLISHED", "ACTIVE", "", ""),
                new SkuOfferVO("s3", "p3", "m1", "store", "商品3", "默认", 300, 4, "UNPUBLISHED", "ACTIVE", "", "")
            )
        );
        when(merchants.findAll(List.of("m1", "m2"))).thenReturn(List.of(merchant("m1", "ACTIVE"), merchant("m2", "SUSPENDED")));
        when(inventory.stocks(List.of("s1", "s2", "s3"))).thenReturn(List.of(new StockVO("m1", "store", "s1", 8, 3, 0)));
        var query = new CartQueryCaseImpl(cart, catalog, inventory, merchants);
        var result = query.list("u").stream().map(ApiViews::cart).toList();
        assertEquals(3, result.size());
        assertEquals(5, result.get(0).getAvailable());
        assertTrue(result.get(0).getSellable());
        assertFalse(result.get(1).getSellable());
        assertFalse(result.get(2).getSellable());
        assertEquals("商户m2", result.get(1).getMerchantName());
        verify(merchants).findAll(List.of("m1", "m2"));
        verify(merchants, never()).find(anyString());
    }

    @Test
    void inactiveAccountAndEmptyCartNeverLoadOtherDomains() {
        when(cart.list("disabled")).thenThrow(new AppException(ResponseCode.AUTH_FORBIDDEN));
        var query = new CartQueryCaseImpl(cart, catalog, inventory, merchants);
        assertThrows(AppException.class, () -> query.list("disabled"));
        assertTrue(query.list("empty").isEmpty());
        verifyNoInteractions(catalog, inventory, merchants);
    }

    @Test
    void stockPageLoadsOnlyAuthorizedMerchantFacts() {
        var stock = new StockVO("m", "store", "sku", 5, 2, 3);
        var offer = new SkuOfferVO("sku", "product", "m", "store", "笔", "黑色", 150, 1, "PUBLISHED", "ACTIVE", "", "");
        when(products.stocks("u", "m", 1, 20, "")).thenReturn(List.of(stock));
        when(products.stockOffers("u", "m", List.of("sku"))).thenReturn(Map.of("sku", offer));
        when(products.countStocks("u", "m", "")).thenReturn(1L);
        var query = new CatalogQueryCaseImpl(products, catalog, inventory, merchants);
        var page = query.stockPage("u", "m", 1, 20, "");
        assertEquals(1L, page.total());
        assertEquals(List.of(stock), page.items());
        assertEquals(offer, page.offers().get("sku"));
        verify(products).stocks("u", "m", 1, 20, "");
        verify(products).stockOffers("u", "m", List.of("sku"));
    }

    @Test
    void workspaceQueryLoadsMerchantDetailsInOneBatch() {
        var access = mock(IAccessService.class);
        when(access.memberships("actor")).thenReturn(
            List.of(new MembershipVO("m1", "actor", "OWNER", "ACTIVE"), new MembershipVO("m2", "actor", "CLERK", "ACTIVE"))
        );
        when(merchants.findAll(List.of("m1", "m2"))).thenReturn(List.of(merchant("m2", "ACTIVE"), merchant("m1", "ACTIVE")));
        when(access.permissions("actor", "m1")).thenReturn(java.util.Set.of("product.read"));
        var query = new WorkspaceQueryCaseImpl(access, merchants);
        var result = query.workspace("actor");
        assertEquals(List.of("m1", "m2"), result.merchants().stream().map(MerchantVO::id).toList());
        assertEquals(java.util.Set.of("product.read"), result.merchantPermissions().get("m1"));
        verify(merchants).findAll(List.of("m1", "m2"));
        verify(merchants, never()).find(anyString());
    }
    @Test
    void workspaceQuerySplitsMerchantsWhenMembershipsExceedSingleBatchLimit() {
        var access = mock(IAccessService.class);
        var memberships = new ArrayList<MembershipVO>();
        var stores = new ArrayList<MerchantVO>();
        for (int i = 0; i < 101; i++) {
            memberships.add(new MembershipVO("m" + i, "actor", "CLERK", "ACTIVE"));
            stores.add(merchant("m" + i, "ACTIVE"));
        }
        when(access.memberships("actor")).thenReturn(memberships);
        when(merchants.findAll(anyList())).thenAnswer(invocation -> {
            List<String> ids = invocation.getArgument(0);
            assertTrue(ids.size() <= 100);
            return stores.stream().filter(store -> ids.contains(store.id())).toList();
        });
        var query = new WorkspaceQueryCaseImpl(access, merchants);
        var result = query.workspace("actor");
        assertEquals(101, result.merchants().size());
        assertEquals("m100", result.merchants().get(100).id());
        verify(merchants, times(2)).findAll(anyList());
    }


}
