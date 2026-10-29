package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import java.util.List;

/** 售后领域能力：管理单笔未提货退款申请，不直接变更订单、库存或自提任务。 */
public interface IAfterSaleService {
    long countAfterSales(String buyer, String merchant, String status);
    AfterSaleVO afterSale(String order, boolean lock);
    AfterSaleVO requestAfterSale(OrderAggregate order, String buyer, String reason);
    void rejectAfterSale(String order, String reason);
    void appeal(OrderAggregate order, String buyer);
    void approveAfterSale(String order, String reason);
    List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int page, int size);
}
