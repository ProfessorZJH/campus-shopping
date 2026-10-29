package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 库存补货数量。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReplenishRequestDTO {
    private Integer quantity;
}
