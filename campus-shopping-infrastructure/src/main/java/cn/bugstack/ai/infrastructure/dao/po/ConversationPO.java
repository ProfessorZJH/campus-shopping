package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 用户私有会话。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ConversationPO {
    private String id;
    private String userId;
    private String title;
    private Instant createdAt;
}
