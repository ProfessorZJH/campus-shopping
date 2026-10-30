package cn.bugstack.ai.domain.fulfillment.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.fulfillment.adapter.repository.IFulfillmentRepository;
import cn.bugstack.ai.domain.fulfillment.model.aggregate.PickupAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.*;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** 自提状态机实现，凭证为 256 位随机值，仅保存 SHA-256 摘要。 */
@Service
public class FulfillmentServiceImpl implements IFulfillmentService {

    private final IFulfillmentRepository repository;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public FulfillmentServiceImpl(IFulfillmentRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void create(String order, String merchant, String store, String buyer) {
        PickupVO old = repository.pickup(order, true);
        if (old != null) {
            require(old.merchantId().equals(merchant) && old.storeId().equals(store) && old.buyerId().equals(buyer), ResponseCode.STATE_CONFLICT);
            return;
        }
        repository.insert(new PickupVO(UUID.randomUUID().toString(), order, merchant, store, buyer, PickupStatusEnumVO.WAIT_PREP.getCode(), null, null));
    }

    public List<PickupVO> pickupsByOrders(List<String> orders) {
        require(orders != null && orders.size() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return repository.pickupsByOrders(orders);
    }

    public PickupVO pickup(String order, boolean lock) {
        return repository.pickup(order, lock);
    }

    private PickupAggregate required(String order) {
        PickupVO p = repository.pickup(order, true);
        require(p != null, ResponseCode.NOT_FOUND);
        return new PickupAggregate(p);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void prepare(String order, boolean ready) {
        PickupAggregate p = required(order);
        if (ready) p.ready();
        else p.prepare();
        repository.save(p.view());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public PickupTokenVO issue(String order) {
        PickupAggregate p = required(order);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = clock.instant().plusSeconds(1200);
        p.issue(token, expires);
        repository.save(p.view());
        return new PickupTokenVO(token, expires);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean verify(String order, String token, String actor) {
        PickupAggregate p = required(order);
        boolean changed = p.verify(token, clock.instant());
        if (changed) {
            repository.save(p.view());
            repository.verify(p.view().id(), actor);
        }
        return changed;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancel(String order) {
        PickupAggregate p = required(order);
        p.cancel();
        repository.save(p.view());
    }

    public List<PickupVO> list(String merchant, String status, int page, int size) {
        return repository.list(merchant, PickupStatusEnumVO.filter(status), offset(page, size), size);
    }
}
