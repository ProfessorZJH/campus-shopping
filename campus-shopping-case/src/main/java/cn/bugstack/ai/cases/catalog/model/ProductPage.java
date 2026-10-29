package cn.bugstack.ai.cases.catalog.model;

import java.util.List;

/** 列表和总数在同一个只读事务中取得。 */
public record ProductPage(List<ProductReadModel> items, long total) {
    public ProductPage {
        items = List.copyOf(items);
    }
}
