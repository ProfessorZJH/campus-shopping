package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import java.util.List;

/** 知识库、版本与发布指针的本地领域能力；外部向量索引须经 Port。 */
public interface IKnowledgeStateService {
    KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor);
    List<KnowledgeBaseVO> bases();
    KnowledgeBaseVO base(String id);
    KnowledgeDocumentVO createDocument(String root, String base, String title, String content);
    KnowledgeDocumentVO document(String id);
    List<KnowledgeDocumentVO> documents(String base, int page, int size);
    long countDocuments(String base);
    List<KnowledgeDocumentVO> visible(List<String> bases);
    void indexState(String id, String status, String error);
    void publish(String id);
    void withdraw(String id);
}
