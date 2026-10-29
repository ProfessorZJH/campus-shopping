package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 平台经营状态变更。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class StateRequestDTO {
    private Boolean active;
    private String reason;
}
