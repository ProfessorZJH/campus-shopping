package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexAttemptVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IKnowledgeService {
    KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor);
    List<KnowledgeBaseVO> bases();
    KnowledgeBaseVO base(String id);
    KnowledgeDocumentVO createDocument(String root, String base, String title, String content);
    KnowledgeDocumentVO document(String id);
    List<KnowledgeDocumentVO> documents(String base, int page, int size);
    List<KnowledgeScopeVO> visibleScope(List<String> bases);
    List<KnowledgeDocumentVO> documentsByIds(List<String> ids);
    long countDocuments(String base);
    KnowledgeIndexAttemptVO beginIndex(String id);
    boolean completeIndex(KnowledgeIndexAttemptVO attempt, boolean ready, String error);
    void publish(String id);
    void withdraw(String id);
}
