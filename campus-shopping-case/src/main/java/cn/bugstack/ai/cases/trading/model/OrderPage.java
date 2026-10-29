package cn.bugstack.ai.cases.trading.model;

import java.util.List;

public record OrderPage(List<OrderReadModel> items, long total) {}
