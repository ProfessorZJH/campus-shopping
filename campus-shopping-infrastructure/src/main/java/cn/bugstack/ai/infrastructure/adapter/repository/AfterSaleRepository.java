package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.trading.adapter.repository.IAfterSaleRepository;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.AfterSalePO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.List;

import static cn.bugstack.ai.types.common.Checks.require;

/** 售后仓储只维护申请/裁决事实，订单退款记录仍由订单仓储处理。 */
@Repository
public class AfterSaleRepository implements IAfterSaleRepository {
    @Resource
    private ITradingDao dao;

    @Override
    public long countAfterSales(String buyer, String merchant, String status) {
        return dao.countAfterSales(buyer, merchant, status);
    }

    @Override
    public AfterSaleVO afterSale(String order, boolean lock) {
        return convert(dao.afterSale(order, lock));
    }

    @Override
    public void insert(AfterSaleVO sale) {
        dao.insertAfterSale(AfterSalePO.builder()
                .id(sale.id()).orderId(sale.orderId())
                .buyerId(sale.buyerId()).merchantId(sale.merchantId())
                .status(sale.status()).reason(sale.reason())
                .decisionReason(sale.decisionReason()).createdAt(sale.createdAt()).build());
    }

    @Override
    public void save(AfterSaleVO sale) {
        require(dao.saveAfterSale(sale.id(), sale.status(), sale.decisionReason()) == 1,
                ResponseCode.NOT_FOUND);
    }

    @Override
    public List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int offset, int size) {
        return dao.afterSales(buyer, merchant, status, offset, size)
                .stream().map(this::convert).toList();
    }

    private AfterSaleVO convert(AfterSalePO po) {
        return po == null ? null : new AfterSaleVO(
                po.getId(), po.getOrderId(), po.getBuyerId(), po.getMerchantId(),
                po.getStatus(), po.getReason(), po.getDecisionReason(), po.getCreatedAt());
    }
}
