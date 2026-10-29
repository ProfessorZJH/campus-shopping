package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IKnowledgeService {
    KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor);
    List<KnowledgeBaseVO> bases();
    KnowledgeBaseVO base(String id);
    KnowledgeDocumentVO createDocument(String root, String base, String title, String content);
    KnowledgeDocumentVO document(String id);
    List<KnowledgeDocumentVO> documents(String base, int page, int size);
    List<KnowledgeDocumentVO> visible(List<String> bases);
    long countDocuments(String base);
    void indexState(String id, String status, String error);
    void publish(String id);
    void withdraw(String id);
}
