package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.trading.adapter.repository.IAfterSaleRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class AfterSaleRepository implements IAfterSaleRepository {

    @Resource
    private ITradingDao dao;

    public List<AfterSaleVO> afterSalesByOrders(List<String> orders) {
        return orders.isEmpty() ? List.of() : dao.afterSalesByOrders(orders).stream().map(this::afterSale).toList();
    }

    public long countAfterSales(String buyer, String merchant, String status) {
        return dao.countAfterSales(buyer, merchant, status);
    }

    public AfterSaleVO afterSale(String order, boolean lock) {
        return afterSale(dao.afterSale(order, lock));
    }

    public void insertAfterSale(AfterSaleVO a) {
        dao.insertAfterSale(
            AfterSalePO.builder()
                .id(a.id())
                .orderId(a.orderId())
                .buyerId(a.buyerId())
                .merchantId(a.merchantId())
                .status(a.status())
                .reason(a.reason())
                .decisionReason(a.decisionReason())
                .createdAt(a.createdAt())
                .build()
        );
    }

    public void saveAfterSale(String id, String status, String reason) {
        require(dao.saveAfterSale(id, status, reason) == 1, ResponseCode.NOT_FOUND);
    }

    public List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int offset, int size) {
        return dao.afterSales(buyer, merchant, status, offset, size).stream().map(this::afterSale).toList();
    }

    private AfterSaleVO afterSale(AfterSalePO p) {
        return p == null
            ? null
            : new AfterSaleVO(
                  p.getId(),
                  p.getOrderId(),
                  p.getBuyerId(),
                  p.getMerchantId(),
                  p.getStatus(),
                  p.getReason(),
                  p.getDecisionReason(),
                  p.getCreatedAt()
              );
    }
}
