package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;

/** 消费者自己的导购会话。 */
public record ConversationVO(String id, String userId, String title, Instant createdAt, Instant lastActiveAt, String summary) {
    public ConversationVO(String id, String userId, String title, Instant createdAt) {
        this(id, userId, title, createdAt, createdAt, "");
    }

    public ConversationVO {
        if (lastActiveAt == null) lastActiveAt = createdAt;
        if (summary == null) summary = "";
    }
}
