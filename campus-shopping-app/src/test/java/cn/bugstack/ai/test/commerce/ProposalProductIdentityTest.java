package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.shoppingai.impl.ProposalViewAssembler;
import cn.bugstack.ai.cases.shoppingai.model.ProposalView;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecommendationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProposalProductIdentityTest {

    @Test
    void newRecommendationKeepsTrustedProductIdentity() {
        var quote = new ProposalItemVO("sku-1", "m-1", "笔", "黑色", 100, 2, 1, "/media/x.png", "product-1");
        var result = RecommendationPolicy.select(List.of(new AiRecommendationVO("sku-1", 1, "匹配")), List.of(quote), Map.of("sku-1", 3L));

        assertEquals("product-1", result.get(0).productId());
        assertEquals(100, result.get(0).priceCent());
    }

    @Test
    void oldJsonWithoutProductIdStillDeserializes() throws Exception {
        var mapper = new ObjectMapper();
        var items = mapper.readValue(
            "[{\"skuId\":\"sku-old\",\"merchantId\":\"m-1\",\"title\":\"笔\",\"specKey\":\"黑色\",\"priceCent\":100,\"quoteVersion\":2,\"quantity\":1,\"imageUrl\":\"\"}]",
            new TypeReference<List<ProposalItemVO>>() {}
        );

        assertNull(items.get(0).productId());
        assertEquals(100, items.get(0).priceCent());
    }

    @Test
    void historicalItemsAreResolvedInBatchesWithoutChangingSnapshot() {
        var catalog = mock(ICatalogService.class);
        when(catalog.resolveOffers(anyList())).thenReturn(
            List.of(
                offer("sku-cross", "product-3", "m-2"),
                offer("sku-legacy", "product-2", "m-1"),
                offer("sku-new", "product-1", "m-1"),
                offer("sku-hidden", "product-hidden", "m-1")
            )
        );
        when(catalog.recallByIds(anyList())).thenReturn(List.of(product("product-1", "m-1", "sku-new"), product("product-2", "m-1", "sku-legacy")));

        var proposal = new ProposalVO(
            "proposal-1",
            "user-1",
            "conversation-1",
            "PENDING",
            List.of(
                new ProposalItemVO("sku-new", "m-1", "新提案", "标准", 110, 4, 1, "/media/new.png", "product-1"),
                new ProposalItemVO("sku-legacy", "m-1", "旧提案", "标准", 120, 3, 1, "/media/legacy.png"),
                new ProposalItemVO("sku-hidden", "m-1", "已下架", "标准", 130, 2, 1, "/media/hidden.png", "product-hidden"),
                new ProposalItemVO("sku-missing", "m-1", "失效 SKU", "标准", 140, 1, 1, "/media/missing.png"),
                new ProposalItemVO("sku-cross", "m-1", "跨商户", "标准", 150, 1, 1, "/media/cross.png")
            ),
            "hash",
            Instant.parse("2026-11-06T15:00:00Z")
        );

        var view = ProposalViewAssembler.assemble(List.of(proposal), catalog).get(0);

        assertEquals("product-1", view.items().get(0).productId());
        assertTrue(view.items().get(0).detailAvailable());
        assertEquals("product-2", view.items().get(1).productId());
        assertTrue(view.items().get(1).detailAvailable());
        assertEquals(120, view.items().get(1).snapshot().priceCent());
        assertFalse(view.items().get(2).detailAvailable());
        assertEquals("PRODUCT_UNAVAILABLE", view.items().get(2).detailUnavailableReason());
        assertEquals("LEGACY_ASSOCIATION_MISSING", view.items().get(3).detailUnavailableReason());
        assertEquals("MERCHANT_MISMATCH", view.items().get(4).detailUnavailableReason());
        verify(catalog).resolveOffers(List.of("sku-cross", "sku-hidden", "sku-legacy", "sku-missing", "sku-new"));
        verify(catalog).recallByIds(List.of("product-1", "product-2", "product-hidden"));
        verifyNoMoreInteractions(catalog);
    }

    private SkuOfferVO offer(String sku, String product, String merchant) {
        return new SkuOfferVO(sku, product, merchant, "store-1", "商品", "标准", 100, 1, "PUBLISHED", "ACTIVE", "", "说明");
    }

    private ProductAggregate product(String id, String merchant, String sku) {
        return new ProductAggregate(
            id,
            merchant,
            "store-1",
            "商品",
            "说明",
            "food",
            "",
            "PUBLISHED",
            1,
            List.of(new ProductSkuEntity(sku, "标准", 100, "ACTIVE", 1))
        );
    }
}
