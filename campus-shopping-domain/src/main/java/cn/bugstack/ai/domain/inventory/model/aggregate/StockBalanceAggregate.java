package cn.bugstack.ai.domain.inventory.model.aggregate;
import static cn.bugstack.ai.types.common.Checks.require;
import cn.bugstack.ai.types.enums.ResponseCode;
/** 库存不变量：0 <= reserved <= onHand；状态只经业务行为变更。 */
public final class StockBalanceAggregate {
    private long onHand;
    private long reserved;
    public StockBalanceAggregate(long onHand, long reserved) {
        require(reserved >= 0 && onHand >= reserved, ResponseCode.STOCK_STATE_INVALID);
        this.onHand = onHand; this.reserved = reserved;
    }
    public void replenish(int quantity) { checkQuantity(quantity); onHand = Math.addExact(onHand, quantity); }
    public void reserve(int quantity) {
        checkQuantity(quantity); require(onHand - reserved >= quantity, ResponseCode.STOCK_NOT_ENOUGH); reserved += quantity;
    }
    public void release(int quantity) {
        checkQuantity(quantity); require(reserved >= quantity, ResponseCode.STOCK_STATE_INVALID); reserved -= quantity;
    }
    public void consume(int quantity) {
        checkQuantity(quantity); require(reserved >= quantity && onHand >= quantity, ResponseCode.STOCK_STATE_INVALID);
        reserved -= quantity; onHand -= quantity;
    }
    private void checkQuantity(int q) { require(q > 0 && q <= 1000000, ResponseCode.ILLEGAL_PARAMETER); }
    public long getOnHand() { return onHand; }
    public long getReserved() { return reserved; }
    public long available() { return onHand - reserved; }
}
