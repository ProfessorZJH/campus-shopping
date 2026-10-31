package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.impl.OrderQueryCaseImpl;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.*;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.service.*;
import cn.bugstack.ai.infrastructure.adapter.repository.TradingRepository;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 检查批量查询调用次数和授权顺序，防止将 N+1 原样搬到 Case。 */
class OrderBatchQueryTest {

  private final Instant now = Instant.parse("2026-10-29T10:00:00Z");

  private OrderAggregate order(String id) {
    return new OrderAggregate(
      id,
      "buyer",
      "m",
      "s",
      List.of(new OrderItemEntity("sku", "历史标题", "黑色", 100, 1, "/media/history.png")),
      "PAID",
      now.plusSeconds(600),
      now
    );
  }

  @Test
  void hundredOrdersLoadItemsWithOneInQuery() {
    var dao = mock(ITradingDao.class);
    var repository = new TradingRepository();
    ReflectionTestUtils.setField(repository, "dao", dao);
    var rows = new ArrayList<OrderPO>();
    var items = new ArrayList<OrderItemPO>();
    for (int i = 0; i < 100; i++) {
      String id = "o" + i;
      rows.add(
        OrderPO.builder()
          .id(id)
          .buyerId("buyer")
          .merchantId("m")
          .storeId("s")
          .totalCent(100L)
          .status("PAID")
          .deadline(now.plusSeconds(600))
          .createdAt(now)
          .build()
      );
      items.add(
        OrderItemPO.builder()
          .orderId(id)
          .skuId("sku")
          .title("历史标题")
          .specKey("黑色")
          .unitPriceCent(100L)
          .quantity(1)
          .imageUrl("/media/history.png")
          .build()
      );
    }
    when(dao.orders("buyer", null, "", 0, 100, "")).thenReturn(rows);
    when(dao.itemsByOrders(anyList())).thenReturn(items);
    var result = repository.orders("buyer", null, "", 0, 100, "");
    assertEquals(100, result.size());
    assertTrue(
      result.stream().allMatch(o -> o.getItems().get(0).imageUrl().equals("/media/history.png"))
    );
    verify(dao, times(1)).itemsByOrders(rows.stream().map(OrderPO::getId).toList());
    verify(dao, never()).items(anyString(), anyBoolean());
    verifyNoMoreInteractionsAfterRead(dao);
  }

  private void verifyNoMoreInteractionsAfterRead(ITradingDao dao) {
    verify(dao).orders("buyer", null, "", 0, 100, "");
    verifyNoMoreInteractions(dao);
  }

  @Test
  void pageUsesThreeBatchEnrichmentQueriesRegardlessOfOrderCount() {
    var orders = mock(IOrderQueryService.class);
    var refunds = mock(IAfterSaleQueryService.class);
    var pickup = mock(IFulfillmentService.class);
    var merchants = mock(IMerchantService.class);
    var access = mock(IAccessService.class);
    var accounts = mock(IUserAccountService.class);
    var useCase = new OrderQueryCaseImpl(orders, refunds, pickup, merchants, access, accounts);
    var page = new ArrayList<OrderAggregate>();
    for (int i = 0; i < 100; i++) page.add(order("o" + i));
    var ids = page.stream().map(OrderAggregate::getId).toList();
    when(orders.orders("buyer", null, "PAID", 1, 100, "")).thenReturn(page);
    when(orders.countOrders("buyer", null, "PAID", "")).thenReturn(100L);
    when(merchants.findAll(List.of("m"))).thenReturn(
      List.of(new MerchantVO("m", null, "商户", "文具", "ACTIVE", "s", "店铺", "校园"))
    );
    when(pickup.pickupsByOrders(ids)).thenReturn(
      List.of(new PickupVO("task", "o3", "m", "s", "buyer", "READY", null, null))
    );
    var result = useCase.mine("buyer", "PAID", 1, 100);
    assertEquals(100, result.total());
    assertEquals(100, result.items().size());
    assertEquals("READY", result.items().get(3).pickup().status());
    assertNull(result.items().get(4).pickup());
    assertTrue(
      result
        .items()
        .stream()
        .allMatch(o -> o.merchantName().equals("商户"))
    );
    verify(pickup).pickupsByOrders(ids);
    verify(refunds).afterSalesByOrders(ids);
    verify(merchants).findAll(List.of("m"));
    verifyNoMoreInteractions(pickup, refunds, merchants);
  }

  @Test
  void unauthorizedMerchantCannotReadAnyOrderRows() {
    var orders = mock(IOrderQueryService.class);
    var refunds = mock(IAfterSaleQueryService.class);
    var pickup = mock(IFulfillmentService.class);
    var merchants = mock(IMerchantService.class);
    var access = mock(IAccessService.class);
    var accounts = mock(IUserAccountService.class);
    doThrow(new AppException(ResponseCode.AUTH_FORBIDDEN))
      .when(access)
      .requirePermission("attacker", "m", "order.read");
    var useCase = new OrderQueryCaseImpl(orders, refunds, pickup, merchants, access, accounts);
    assertThrows(AppException.class, () -> useCase.merchant("attacker", "m", null, 1, 100, ""));
    verifyNoInteractions(orders, refunds, pickup, merchants);
  }

  @Test
  void emptyPageDoesNotIssueEmptyInQueries() {
    var dao = mock(ITradingDao.class);
    var repository = new TradingRepository();
    ReflectionTestUtils.setField(repository, "dao", dao);
    when(dao.orders("buyer", null, "", 0, 100, "")).thenReturn(List.of());
    assertTrue(repository.orders("buyer", null, "", 0, 100, "").isEmpty());
    verify(dao, never()).itemsByOrders(anyList());
    verify(dao, never()).items(anyString(), anyBoolean());
  }
}
