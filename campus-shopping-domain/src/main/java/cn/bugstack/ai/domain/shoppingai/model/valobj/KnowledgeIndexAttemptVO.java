package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 一次索引请求的持久化比较令牌；迟到结果不能覆盖后续请求。 */
public record KnowledgeIndexAttemptVO(String documentId, String token) {}
