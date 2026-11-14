package cn.bugstack.ai.test.commerce;

import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.inventory.adapter.repository.IInventoryQueryRepository;
import cn.bugstack.ai.domain.inventory.adapter.repository.IInventoryRepository;
import cn.bugstack.ai.domain.inventory.model.valobj.ReservationStatusEnumVO;
import cn.bugstack.ai.domain.inventory.model.valobj.ReservationVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.impl.InventoryServiceImpl;
import java.util.List;
import org.junit.jupiter.api.Test;

class InventoryFinishLockOrderTest {

    @Test
    void releaseAcquiresStockLocksInSkuOrder() {
        assertFinishLockOrder(false);
    }

    @Test
    void consumeAcquiresStockLocksInSkuOrder() {
        assertFinishLockOrder(true);
    }

    private void assertFinishLockOrder(boolean consume) {
        var repository = mock(IInventoryRepository.class);
        var service = new InventoryServiceImpl(repository, mock(IInventoryQueryRepository.class));
        String reserved = ReservationStatusEnumVO.RESERVED.getCode();
        when(repository.reservations("order")).thenReturn(
            List.of(new ReservationVO("order", "store", "sku-b", 1, reserved), new ReservationVO("order", "store", "sku-a", 1, reserved))
        );
        when(repository.stock("store", "sku-a", true)).thenReturn(new StockVO("merchant", "store", "sku-a", 10, 4, 1));
        when(repository.stock("store", "sku-b", true)).thenReturn(new StockVO("merchant", "store", "sku-b", 10, 4, 1));

        if (consume) service.consume("order");
        else service.release("order");

        var locks = inOrder(repository);
        locks.verify(repository).stock("store", "sku-a", true);
        locks.verify(repository).stock("store", "sku-b", true);
        int onHand = consume ? 9 : 10;
        verify(repository).save(new StockVO("merchant", "store", "sku-a", onHand, 3, 1));
        verify(repository).save(new StockVO("merchant", "store", "sku-b", onHand, 3, 1));
        String finished = (consume ? ReservationStatusEnumVO.CONSUMED : ReservationStatusEnumVO.RELEASED).getCode();
        verify(repository).transition("order", "sku-a", finished);
        verify(repository).transition("order", "sku-b", finished);
    }
}
