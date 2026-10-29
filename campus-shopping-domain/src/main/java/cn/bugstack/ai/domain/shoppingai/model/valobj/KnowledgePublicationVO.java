package cn.bugstack.ai.domain.shoppingai.model.valobj;

/**
 * 文档发布/撤回时的受锁保护快照。
 *
 * rootVersion、activeDocumentId 必须来自同一事务中已加行锁的文档根；
 * 发布决策在 Domain 完成，Repository 只负责按决策更新数据库。
 */
public record KnowledgePublicationVO(
        String documentId,
        String rootId,
        String activeDocumentId,
        int documentVersion,
        int latestVersion,
        String indexStatus) {
}
