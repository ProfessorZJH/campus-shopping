package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 新增规格，金额单位为分。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SkuRequestDTO {
    private String specKey;
    private Long priceCent;
}
