package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 不携带正文的已发布知识授权投影，版本身份由不可变 documentId 表达。 */
public record KnowledgeScopeVO(String id, String title, String visibility) {}
