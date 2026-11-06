package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.*;
import java.util.*;

/** 按明确期间聚合的模拟经营统计只读投影。 */
public record OperationsStatisticsVO(
    Instant periodStart,
    Instant periodEnd,
    String timezone,
    Instant asOf,
    long totalOrders,
    long paidOrders,
    long refundedOrders,
    long completedAmountCent,
    List<Trend> trend,
    List<Status> statuses,
    List<Product> products
) {
    public OperationsStatisticsVO {
        trend = List.copyOf(trend == null ? List.of() : trend);
        statuses = List.copyOf(statuses == null ? List.of() : statuses);
        products = List.copyOf(products == null ? List.of() : products);
        if (periodStart == null || periodEnd == null || asOf == null || timezone == null || periodStart.isAfter(periodEnd)) throw new IllegalArgumentException("统计期间无效");
    }

    public record Trend(String day, long orderCount) {}
    public record Status(String status, long orderCount, long amountCent) {}
    public record Product(String skuId, String title, long quantity) {}
}
