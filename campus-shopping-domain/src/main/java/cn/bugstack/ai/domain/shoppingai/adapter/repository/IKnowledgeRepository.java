package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IKnowledgeRepository {
  void createBase(KnowledgeBaseVO base, String actor);
  List<KnowledgeBaseVO> bases();
  KnowledgeBaseVO base(String id);
  KnowledgeDocumentVO createDocument(
    String id,
    String root,
    String base,
    String title,
    String content
  );
  KnowledgeDocumentVO document(String id);
  List<KnowledgeDocumentVO> documents(String base, int offset, int size);
  List<KnowledgeDocumentVO> visible(List<String> bases);
  long countDocuments(String base);
  void indexState(String id, String status, String error);
  cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate lockPublication(
    String id
  );
  void savePublication(
    cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate publication
  );
}
