package cn.bugstack.ai.domain.inventory.model.valobj;

import java.time.Instant;

/** 库存流水，统一由领域枚举定义操作类型；读取给商户时沿用字符串协议。 */
public record StockMovementVO(String id, String skuId, String type, int quantity, String bizKey,
                              Instant createdAt) {
    public StockMovementVO {
        StockMovementTypeEnumVO.fromCode(type);
    }

    public StockMovementTypeEnumVO typeEnum() {
        return StockMovementTypeEnumVO.fromCode(type);
    }
}
