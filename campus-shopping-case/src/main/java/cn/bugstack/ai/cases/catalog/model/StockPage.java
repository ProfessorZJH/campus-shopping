package cn.bugstack.ai.cases.catalog.model;

import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import java.util.List;
import java.util.Map;

/** 库存分页读模型：领域事实在 Case 层聚合，HTTP 层只做 DTO 映射。 */
public record StockPage(List<StockVO> items, Map<String, SkuOfferVO> offers, long total) {}
