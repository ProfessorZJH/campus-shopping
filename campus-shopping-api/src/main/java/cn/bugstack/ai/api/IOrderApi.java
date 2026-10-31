package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 OrderController 实现。 */
public interface IOrderApi {
  /** 核价、预占、建单、清理购物车同事务。 */
  Response<OrderResponseDTO> checkout(CheckoutRequestDTO request, String key, Principal principal);
  /** 本人订单列表。 */
  Response<List<OrderResponseDTO>> mine(String state, int page, int size, Principal principal);
  Response<PageResponseDTO<OrderResponseDTO>> minePage(
    String state,
    int page,
    int size,
    Principal principal
  );
  /** 本人、当前商户成员或平台管理员可查订单详情。 */
  Response<OrderResponseDTO> detail(String orderId, Principal principal);
  /** 商户待处理订单。 */
  Response<List<OrderResponseDTO>> merchantOrders(
    String merchantId,
    String state,
    int page,
    int size,
    Principal principal
  );
  Response<PageResponseDTO<OrderResponseDTO>> merchantOrdersPage(
    String merchantId,
    String state,
    int page,
    int size,
    String q,
    Principal principal
  );
  /** 本人模拟支付，不产生真实资金。 */
  Response<OrderResponseDTO> pay(String orderId, Principal principal);
  /** 取消本人未付款订单并释放预占。 */
  Response<OrderResponseDTO> cancel(String orderId, Principal principal);
  /** Owner 经营统计。 */
  Response<StatisticsResponseDTO> merchantStatistics(String merchantId, Principal principal);
  /** 平台订单汇总。 */
  Response<StatisticsResponseDTO> platformStatistics(Principal principal);
  Response<PageResponseDTO<OrderResponseDTO>> platformOrdersPage(
    String state,
    int page,
    int size,
    String q,
    Principal principal
  );
  /** 平台受控订单监管。 */
  Response<List<OrderResponseDTO>> platformOrders(
    String state,
    int page,
    int size,
    Principal principal
  );
}
