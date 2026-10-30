package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.*;
import java.util.*;

/** 交易经营统计；金额是模拟交易金额，不是实际结算收入。 */
public record TradingStatsVO(long totalOrders, long pendingCount, long paidCount, long completedCount, long refundedCount, long completedAmountCent) {}
