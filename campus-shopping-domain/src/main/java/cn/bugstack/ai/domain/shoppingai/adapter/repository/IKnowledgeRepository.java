package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgePublicationVO;
import java.util.List;

/** 知识元数据、文档版本与激活指针；远程索引不属于此 Repository。 */
public interface IKnowledgeRepository {
    void createBase(KnowledgeBaseVO base, String actor);
    List<KnowledgeBaseVO> bases();
    KnowledgeBaseVO base(String id);
    KnowledgeDocumentVO createDocument(String id, String root, String base, String title, String content);
    KnowledgeDocumentVO document(String id);
    List<KnowledgeDocumentVO> documents(String base, int offset, int size);
    long countDocuments(String base);
    List<KnowledgeDocumentVO> visible(List<String> bases);
    void indexState(String id, String status, String error);
    /** 按文档根加行锁读取发布快照，必须在外层事务中使用。 */
    KnowledgePublicationVO lockPublication(String id);
    /** 领域校验后执行数据切换，不在 Infrastructure 决定业务规则。 */
    void publish(KnowledgePublicationVO decision);
    void withdraw(KnowledgePublicationVO decision, boolean deactivate);
}
