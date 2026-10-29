package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 仅映射成员表。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MembershipPO {
    private String merchantId;
    private String userId;
    private String role;
    private String status;
}
