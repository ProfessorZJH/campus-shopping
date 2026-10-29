package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 用户私有会话。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationPO {

    private String id;
    private String userId;
    private String title;
    private Instant createdAt;
}
