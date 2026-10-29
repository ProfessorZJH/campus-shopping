package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 未提货全额模拟退款请求。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RefundRequestDTO {
    private String reason;
}
