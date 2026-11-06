package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.catalog.impl.CatalogCaseImpl;
import cn.bugstack.ai.cases.catalog.impl.CatalogQueryCaseImpl;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.merchant.impl.WorkspaceQueryCaseImpl;
import cn.bugstack.ai.cases.trading.impl.CartQueryCaseImpl;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.trigger.http.ApiViews;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CatalogCartReadModelTest {

    private final ICartService cart = mock(ICartService.class);
    private final IUserAccountService accounts = mock(IUserAccountService.class);
    private final ICatalogService catalog = mock(ICatalogService.class);
    private final IAccessService access = mock(IAccessService.class);
    private final IInventoryService inventory = mock(IInventoryService.class);
    private final IMerchantService merchants = mock(IMerchantService.class);
    private final IProductImageRepository images = mock(IProductImageRepository.class);

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
        assertThrows(IllegalArgumentException.class, () -> new ProductReadModel(product, "商户", Map.of(), List.of()));
        assertThrows(IllegalArgumentException.class, () -> new ProductReadModel(product, "  ", Map.of("s", 0L), List.of()));
        assertThrows(NullPointerException.class, () -> new ProductReadModel(product, "商户", Map.of("s", 0L), null));
        var dto = ApiViews.product(ProductReadModel.from(product, "商户", Map.of(), List.of()));
        assertEquals(0L, dto.getSkus().get(0).getAvailable());
        assertEquals("商户", dto.getMerchantName());
    }

    @Test
    void addingSkuReturnsCurrentImagesAndDoesNotHideImageReadFailure() {
        var product = new ProductAggregate(
            "p",
            "m",
            "store",
            "商品",
            "",
            "stationery",
            "/media/a.png",
            "PUBLISHED",
            0,
            List.of(new ProductSkuEntity("s", "默认", 100, "ACTIVE", 0))
        );
        var photo = new ProductImageVO("image", "LOCAL", "a.png", "/media/a.png", 0);
        when(merchants.requireActiveForNewTrade("m")).thenReturn(merchant("m", "ACTIVE"));
        when(catalog.addSku("m", "p", "新增", 200)).thenReturn(product);
        when(inventory.stocksForProductWrite(List.of("s"))).thenReturn(List.of(new StockVO("m", "store", "s", 5, 1, 0)));
        when(images.findAllForUpdate("p")).thenReturn(List.of(photo));
        var useCase = new CatalogCaseImpl(catalog, inventory, merchants, access, images);

        var result = useCase.addSkuToProduct("u", "m", "p", "新增", 200);
        assertEquals(List.of(photo), result.images());
        assertEquals(4L, result.availableBySku().get("s"));
        verify(inventory).stocksForProductWrite(List.of("s"));
        assertEquals("/media/a.png", ApiViews.product(result).getImages().get(0).getUrl());
        verify(access).requirePermission("u", "m", "product.write");
        verify(images).findAllForUpdate("p");

        when(images.findAllForUpdate("p")).thenThrow(new IllegalStateException());
        assertThrows(IllegalStateException.class, () -> useCase.addSkuToProduct("u", "m", "p", "新增", 200));
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
                    i == 0 ? "/media/a.png" : "",
                    "PUBLISHED",
                    0,
                    List.of(new ProductSkuEntity("s" + i, "默认", 100, "ACTIVE", 0))
                )
            );
            shops.add(merchant("m" + i, "ACTIVE"));
        }
        when(catalog.search(null, "", null, true, 1, 100, null, null)).thenReturn(rows);
        var ids = rows.stream().map(ProductAggregate::getMerchantId).toList();
        when(merchants.findAll(ids)).thenReturn(shops);
        var productIds = rows.stream().map(ProductAggregate::getId).toList();
        var photo = new ProductImageVO("image", "LOCAL", "a.png", "/media/a.png", 0);
        when(images.findAll(productIds)).thenReturn(Map.of("p0", List.of(photo)));
        var query = new CatalogQueryCaseImpl(catalog, inventory, merchants, access, images);
        var result = query.publicProducts(null, "", null, null, null, 1, 100).stream().map(ApiViews::product).toList();
        assertEquals(100, result.size());
        assertEquals("/media/a.png", result.get(0).getImages().get(0).getUrl());
        verify(images).findAll(productIds);
        for (int i = 0; i < 100; i++) assertEquals("商户m" + i, result.get(i).getMerchantName());
        verify(merchants).findAll(ids);
        verify(merchants, never()).find(anyString());
        verify(inventory).stocks(anyList());
    }

    @Test
    void deniedAndEmptyProductPagesDoNotReadEnrichment() {
        doThrow(new AppException(ResponseCode.AUTH_FORBIDDEN)).when(access).requirePermission("u", "m", "product.read");
        var query = new CatalogQueryCaseImpl(catalog, inventory, merchants, access, images);
        assertThrows(AppException.class, () -> query.managedProducts("u", "m", 1, 20));
        assertTrue(query.publicProducts(null, "", null, null, null, 1, 20).isEmpty());
        verifyNoInteractions(inventory, merchants, images);
    }

    @Test
    void cartUsesBatchFactsAndPreservesUnavailableRows() {
        when(cart.cart("u")).thenReturn(List.of(new CartItemVO("u", "m1", "s1", 2), new CartItemVO("u", "m2", "s2", 1), new CartItemVO("u", "m1", "s3", 1)));
        when(catalog.offers(List.of("s1", "s2", "s3"))).thenReturn(
            List.of(
                new SkuOfferVO("s1", "p1", "m1", "store", "商品1", "默认", 100, 2, "PUBLISHED", "ACTIVE", "", ""),
                new SkuOfferVO("s2", "p2", "m2", "store", "商品2", "默认", 200, 3, "PUBLISHED", "ACTIVE", "", ""),
                new SkuOfferVO("s3", "p3", "m1", "store", "商品3", "默认", 300, 4, "UNPUBLISHED", "ACTIVE", "", "")
            )
        );
        when(merchants.findAll(List.of("m1", "m2"))).thenReturn(List.of(merchant("m1", "ACTIVE"), merchant("m2", "SUSPENDED")));
        when(inventory.stocks(List.of("s1", "s2", "s3"))).thenReturn(List.of(new StockVO("m1", "store", "s1", 8, 3, 0)));
        var query = new CartQueryCaseImpl(cart, accounts, catalog, inventory, merchants);
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

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({ "0,0", "3,3", "2,3" })
    void zeroOrNegativeAvailableStockIsNotSellable(long onHand, long reserved) {
        when(cart.cart("u")).thenReturn(List.of(new CartItemVO("u", "m", "s", 4)));
        when(catalog.offers(List.of("s"))).thenReturn(List.of(new SkuOfferVO("s", "p", "m", "store", "商品", "默认", 100, 0, "PUBLISHED", "ACTIVE", "", "")));
        when(merchants.findAll(List.of("m"))).thenReturn(List.of(merchant("m", "ACTIVE")));
        when(inventory.stocks(List.of("s"))).thenReturn(List.of(new StockVO("m", "store", "s", onHand, reserved, 0)));
        var row = new CartQueryCaseImpl(cart, accounts, catalog, inventory, merchants).list("u").get(0);
        assertFalse(row.sellable());
        assertEquals(4, row.item().quantity());
        assertEquals(onHand - reserved, row.available());
    }

    @Test
    void inactiveAccountAndEmptyCartNeverLoadOtherDomains() {
        doThrow(new AppException(ResponseCode.AUTH_FORBIDDEN)).when(accounts).requireActive("disabled");
        var query = new CartQueryCaseImpl(cart, accounts, catalog, inventory, merchants);
        assertThrows(AppException.class, () -> query.list("disabled"));
        verifyNoInteractions(cart);
        assertTrue(query.list("empty").isEmpty());
        var order = inOrder(accounts, cart);
        order.verify(accounts).requireActive("empty");
        order.verify(cart).cart("empty");
        verifyNoInteractions(catalog, inventory, merchants);
    }

    @Test
    void stockPageLoadsOnlyAuthorizedMerchantFacts() {
        var stock = new StockVO("m", "store", "sku", 5, 2, 3);
        var offer = new SkuOfferVO("sku", "product", "m", "store", "笔", "黑色", 150, 1, "PUBLISHED", "ACTIVE", "", "");
        when(inventory.list("m", 1, 20, "")).thenReturn(List.of(stock));
        when(catalog.offers(List.of("sku"))).thenReturn(List.of(offer));
        when(inventory.countStocks("m", "")).thenReturn(1L);
        var query = new CatalogQueryCaseImpl(catalog, inventory, merchants, access, images);
        var page = query.stockPage("u", "m", 1, 20, "");
        assertEquals(1L, page.total());
        assertEquals(List.of(stock), page.items());
        assertEquals(offer, page.offers().get("sku"));
        verify(inventory).list("m", 1, 20, "");
        verify(catalog).offers(List.of("sku"));
    }

    @Test
    void workspaceQueryLoadsMerchantDetailsInOneBatch() {
        var access = mock(IAccessService.class);
        var memberships = List.of(new MembershipVO("m1", "actor", "OWNER", "ACTIVE"), new MembershipVO("m2", "actor", "CLERK", "ACTIVE"));
        when(access.memberships("actor")).thenReturn(memberships);
        when(merchants.findAll(List.of("m1", "m2"))).thenReturn(List.of(merchant("m2", "ACTIVE"), merchant("m1", "ACTIVE")));
        when(access.workspacePermissions("actor", memberships)).thenReturn(Map.of("m1", java.util.Set.of("product.read")));
        var query = new WorkspaceQueryCaseImpl(access, merchants);
        var result = query.workspace("actor");
        assertEquals(List.of("m1", "m2"), result.merchants().stream().map(MerchantVO::id).toList());
        assertEquals(java.util.Set.of("product.read"), result.merchantPermissions().get("m1"));
        verify(merchants).findAll(List.of("m1", "m2"));
        verify(merchants, never()).find(anyString());
        verify(access).workspacePermissions("actor", memberships);
        verify(access, never()).permissions(anyString(), anyString());
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
        when(access.workspacePermissions("actor", memberships)).thenReturn(Map.of());
        when(merchants.findAll(anyList())).thenAnswer(invocation -> {
            List<String> ids = invocation.getArgument(0);
            assertTrue(ids.size() <= 100);
            return stores
                .stream()
                .filter(store -> ids.contains(store.id()))
                .toList();
        });
        var query = new WorkspaceQueryCaseImpl(access, merchants);
        var result = query.workspace("actor");
        assertEquals(101, result.merchants().size());
        assertEquals("m100", result.merchants().get(100).id());
        verify(merchants, times(2)).findAll(anyList());
        verify(access).workspacePermissions("actor", memberships);
    }
}
