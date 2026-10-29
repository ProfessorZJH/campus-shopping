package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 知识库的所有权与可见性。 */
public record KnowledgeBaseVO(String id, String name, String merchantId, String visibility) {
    public KnowledgeBaseVO {
        KnowledgeVisibilityEnumVO.fromCode(visibility);
    }

    public KnowledgeVisibilityEnumVO state() {
        return KnowledgeVisibilityEnumVO.fromCode(visibility);
    }
}
