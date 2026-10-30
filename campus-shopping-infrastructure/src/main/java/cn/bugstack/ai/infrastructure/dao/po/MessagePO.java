package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 会话消息与知识访问快照指纹。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessagePO {

    private String id;
    private String conversationId;
    private String role;
    private String content;
    private Instant createdAt;
    private String accessFingerprint;
}
