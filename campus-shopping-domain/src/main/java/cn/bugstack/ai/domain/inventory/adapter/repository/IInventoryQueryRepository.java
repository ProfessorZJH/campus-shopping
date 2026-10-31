package cn.bugstack.ai.domain.inventory.adapter.repository;

import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import java.util.List;

/** 库存只读搜索允许目录标题过滤；写模型不依赖目录表。 */
public interface IInventoryQueryRepository {
  long countStocks(String merchant);
  long countStocks(String merchant, String q);
  List<StockVO> list(String merchant, int offset, int size);
  List<StockVO> list(String merchant, int offset, int size, String q);
}
