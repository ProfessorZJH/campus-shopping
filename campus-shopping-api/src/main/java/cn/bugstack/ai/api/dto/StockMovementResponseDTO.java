package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 库存操作流水。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class StockMovementResponseDTO {
    private String id;
    private String skuId;
    private String type;
    private Integer quantity;
    private String bizKey;
    private Instant createdAt;
}
