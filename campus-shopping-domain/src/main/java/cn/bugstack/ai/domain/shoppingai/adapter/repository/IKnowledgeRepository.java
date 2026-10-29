package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
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
    void publish(String id);
    void withdraw(String id);
}
