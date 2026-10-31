package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.*;
import java.util.*;

/** 交易请求幂等锁记录，结果随订单事务一起提交。 */
public record CheckoutRequestVO(
  String userId,
  String requestKey,
  String fingerprint,
  String orderId
) {}
