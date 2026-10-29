package cn.bugstack.ai.domain.trading.model.valobj;
import java.util.*;
import java.time.*;
/** 交易请求幂等锁记录，结果随订单事务一起提交。 */
public record CheckoutRequestVO(String userId, String requestKey, String fingerprint, String orderId) {}
