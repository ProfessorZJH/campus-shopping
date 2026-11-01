package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.infrastructure.adapter.repository.CatalogRepository;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class CatalogOfferLockOrderTest {

    @Test
    void allProductsAreLockedBeforeSortedSkusAndProjectionCannotSupplyTradeFacts() {
        var dao = mock(ICatalogDao.class);
        var repository = new CatalogRepository();
        ReflectionTestUtils.setField(repository, "dao", dao);
        var ids = List.of("s2", "s1");
        // SKU 顺序与商品顺序相反，旧快照中的价格/状态不能进入交易报价。
        when(dao.offers(ids)).thenReturn(
            List.of(
                OfferPO.builder().skuId("s2").productId("p1").priceCent(1L).productStatus("PUBLISHED").build(),
                OfferPO.builder().skuId("s1").productId("p2").priceCent(1L).productStatus("PUBLISHED").build()
            )
        );
        when(dao.product("p1", true)).thenReturn(
            ProductPO.builder().id("p1").merchantId("m").storeId("store").title("当前1").status("UNPUBLISHED").version(4L).build()
        );
        when(dao.product("p2", true)).thenReturn(
            ProductPO.builder().id("p2").merchantId("m").storeId("store").title("当前2").status("PUBLISHED").version(7L).build()
        );
        when(dao.skuForUpdate("s1")).thenReturn(SkuPO.builder().id("s1").productId("p2").priceCent(200L).status("INACTIVE").build());
        when(dao.skuForUpdate("s2")).thenReturn(SkuPO.builder().id("s2").productId("p1").priceCent(300L).status("ACTIVE").build());
        var offers = repository.offers(ids, true);
        var order = inOrder(dao);
        order.verify(dao).offers(ids);
        order.verify(dao).product("p1", true);
        order.verify(dao).product("p2", true);
        order.verify(dao).skuForUpdate("s1");
        order.verify(dao).skuForUpdate("s2");
        order.verifyNoMoreInteractions();
        assertEquals(
            List.of("s1", "s2"),
            offers
                .stream()
                .map(o -> o.skuId())
                .toList()
        );
        assertEquals(200, offers.get(0).priceCent());
        assertEquals("INACTIVE", offers.get(0).skuStatus());
        assertEquals(7, offers.get(0).version());
        assertEquals("UNPUBLISHED", offers.get(1).productStatus());
        assertEquals("当前1", offers.get(1).title());
    }
}
