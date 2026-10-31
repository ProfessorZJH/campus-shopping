package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexAttemptVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IKnowledgeRepository {
    void createBase(KnowledgeBaseVO base, String actor);
    List<KnowledgeBaseVO> bases();
    KnowledgeBaseVO base(String id);
    KnowledgeDocumentVO createDocument(String id, String root, String base, String title, String content);
    KnowledgeDocumentVO document(String id);
    List<KnowledgeDocumentVO> documents(String base, int offset, int size);
    List<KnowledgeScopeVO> visibleScope(List<String> bases);
    List<KnowledgeDocumentVO> documentsByIds(List<String> ids);
    long countDocuments(String base);
    void reserveDocumentQuota(String base, long bytes, int maxDocuments, long maxBytes);
    void reserveIndexQuota(String id, int maxPerMinute, int maxConcurrent);
    void beginIndex(String id, String attempt);
    boolean completeIndex(KnowledgeIndexAttemptVO attempt, String status, String error);
    cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate lockPublication(String id);
    void savePublication(cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate publication);
}
