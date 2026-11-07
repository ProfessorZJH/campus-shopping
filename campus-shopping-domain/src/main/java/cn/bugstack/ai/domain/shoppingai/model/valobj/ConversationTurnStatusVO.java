package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;

/** 跨实例可见的当前会话轮次状态；不暴露内部租约令牌。 */
public record ConversationTurnStatusVO(String conversationId, String status, Instant cancelRequestedAt) {}
