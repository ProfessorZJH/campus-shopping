package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.inventory.adapter.repository.IInventoryQueryRepository;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 只读查询适配器；跨领域 SQL 由架构白名单约束。 */
@Repository
public class InventoryQueryRepository implements IInventoryQueryRepository {

    @Resource
    private IInventoryQueryDao dao;

    public long countStocks(String merchant) {
        return countStocks(merchant, "");
    }

    public long countStocks(String merchant, String q) {
        return countStocks(merchant, q, null);
    }

    public long countStocks(String merchant, String q, Integer availableBelow) {
        return dao.countStocks(merchant, q, availableBelow);
    }

    public List<StockVO> list(String merchant, int offset, int size) {
        return list(merchant, offset, size, "");
    }

    public List<StockVO> list(String merchant, int offset, int size, String q) {
        return list(merchant, offset, size, q, null);
    }

    public List<StockVO> list(String merchant, int offset, int size, String q, Integer availableBelow) {
        return dao.list(merchant, offset, size, q, availableBelow).stream().map(this::convert).toList();
    }

    public long countMovements(String merchant, String q) {
        return dao.countMovements(merchant, q);
    }

    public List<cn.bugstack.ai.domain.inventory.model.valobj.StockMovementVO> movements(String merchant, int offset, int size, String q) {
        return dao
            .movements(merchant, offset, size, q)
            .stream()
            .map(p ->
                new cn.bugstack.ai.domain.inventory.model.valobj.StockMovementVO(
                    p.getId(),
                    p.getSkuId(),
                    p.getType(),
                    p.getQuantity(),
                    p.getBizKey(),
                    p.getCreatedAt()
                )
            )
            .toList();
    }

    private StockVO convert(StockPO p) {
        return p == null ? null : new StockVO(p.getMerchantId(), p.getStoreId(), p.getSkuId(), p.getOnHand(), p.getReserved(), p.getVersion());
    }
}
