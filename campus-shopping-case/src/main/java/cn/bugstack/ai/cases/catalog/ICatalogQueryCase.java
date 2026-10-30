package cn.bugstack.ai.cases.catalog;

import cn.bugstack.ai.cases.catalog.model.ProductPage;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.catalog.model.StockPage;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockMovementVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import java.util.List;

/** 商品展示查询：权限、分页及跨域快照由用例编排，HTTP 层只映射响应。 */
public interface ICatalogQueryCase {
    List<ProductReadModel> publicProducts(String merchant, String query, String category, int page, int size);
    ProductPage publicPage(String merchant, String query, String category, int page, int size, String sort);
    ProductReadModel detail(String product);
    List<ProductReadModel> managedProducts(String actor, String merchant, int page, int size);
    ProductPage managedPage(String actor, String merchant, String query, String category, String status, int page, int size, String sort);
    List<ProductReadModel> adminProducts(String actor, String merchant, String query, int page, int size);
    ProductPage adminPage(String actor, String merchant, String query, int page, int size);
    List<CategoryVO> categories();
    StockPage stockPage(String actor, String merchant, int page, int size, String query);
    List<StockVO> stockRows(String actor, String merchant, int page, int size);
    List<StockMovementVO> stockMovements(String actor, String merchant, int page, int size);
    long countStockMovements(String actor, String merchant);
}
