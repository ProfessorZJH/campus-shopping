package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.fulfillment.adapter.repository.IFulfillmentRepository;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.infrastructure.dao.IFulfillmentDao;
import cn.bugstack.ai.infrastructure.dao.po.PickupPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.stereotype.Repository;

/**
 * 仓储映射不决定核销资格；核销日志禁止存储明文令牌。
 */
@Repository
public class FulfillmentRepository implements IFulfillmentRepository {

  public List<PickupVO> pickupsByOrders(List<String> orders) {
    return orders.isEmpty()
      ? List.of()
      : dao.pickupsByOrders(orders).stream().map(this::convert).toList();
  }

  @Resource
  private IFulfillmentDao dao;

  public PickupVO pickup(String order, boolean lock) {
    return convert(dao.pickup(order, lock));
  }

  public void insert(PickupVO p) {
    dao.insert(po(p));
  }

  public void save(PickupVO p) {
    require(dao.save(po(p)) == 1, ResponseCode.NOT_FOUND);
  }

  public void verify(String pickup, String actor) {
    dao.verify(UUID.randomUUID().toString(), pickup, actor);
  }

  public List<PickupVO> list(String merchant, String status, int offset, int size) {
    return dao.list(merchant, status, offset, size).stream().map(this::convert).toList();
  }

  private PickupVO convert(PickupPO p) {
    return p == null
      ? null
      : new PickupVO(
          p.getId(),
          p.getOrderId(),
          p.getMerchantId(),
          p.getStoreId(),
          p.getBuyerId(),
          p.getStatus(),
          p.getCredentialHash(),
          p.getExpiresAt()
        );
  }

  private PickupPO po(PickupVO p) {
    return PickupPO.builder()
      .id(p.id())
      .orderId(p.orderId())
      .merchantId(p.merchantId())
      .storeId(p.storeId())
      .buyerId(p.buyerId())
      .status(p.status())
      .credentialHash(p.credentialHash())
      .expiresAt(p.expiresAt())
      .build();
  }
}
