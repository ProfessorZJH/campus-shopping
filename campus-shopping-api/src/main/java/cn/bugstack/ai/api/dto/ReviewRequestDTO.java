package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 审核决定，审核人从登录主体提取。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReviewRequestDTO {
    private Boolean approved;
    private String reason;
}
