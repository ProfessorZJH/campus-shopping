package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import java.util.List;

/** 售后单据仓储，只处理售后事实，不直接写订单和库存。 */
public interface IAfterSaleRepository {
    long countAfterSales(String buyer, String merchant, String status);
    AfterSaleVO afterSale(String order, boolean lock);
    void insert(AfterSaleVO afterSale);
    void save(AfterSaleVO afterSale);
    List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int offset, int size);
}
