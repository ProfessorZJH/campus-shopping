package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 服务端发放的会话处理凭证；token 是跨实例提交时使用的 fencing token。 */
public record ConversationTurnVO(String conversationId, String userId, String token) {}
