package cn.bugstack.ai.api.dto;

import lombok.*;

/** 本次新增数量，由服务端在购物车锁内累计；不预占库存。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartAddRequestDTO {

    private String skuId;
    private Integer quantity;
}
