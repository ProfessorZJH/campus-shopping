package cn.bugstack.ai.domain.inventory.model.valobj;

/** 订单与 SKU 唯一的预占记录；状态只允许预占、释放、消耗。 */
public record ReservationVO(String orderId, String storeId, String skuId, int quantity, String status) {
    public ReservationVO {
        ReservationStatusEnumVO.fromCode(status);
    }

    public ReservationStatusEnumVO statusEnum() {
        return ReservationStatusEnumVO.fromCode(status);
    }
}
