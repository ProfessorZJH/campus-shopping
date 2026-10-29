package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;

/** 消费者自己的导购会话。 */
public record ConversationVO(String id, String userId, String title, Instant createdAt) {}
