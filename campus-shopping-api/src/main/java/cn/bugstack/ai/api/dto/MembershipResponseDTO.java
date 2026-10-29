package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 当前数据库成员授权事实。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MembershipResponseDTO {
    private String merchantId;
    private String userId;
    private String role;
    private String status;
}
