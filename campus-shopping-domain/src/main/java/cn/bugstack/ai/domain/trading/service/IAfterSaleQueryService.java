package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import java.util.List;

/** 售后只读能力，无锁定与状态写入入口。 */
public interface IAfterSaleQueryService {
    List<AfterSaleVO> afterSalesByOrders(List<String> orders);
    long countAfterSales(String buyer, String merchant, String status);
    List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int page, int size);
}
