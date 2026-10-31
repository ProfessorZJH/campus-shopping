package cn.bugstack.ai.cases.shoppingai;

import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.util.*;

/** 后台知识管理与前台 RAG 授权是不同能力。 */
public interface IKnowledgeCase {
  List<KnowledgeBaseVO> managedBases(String actor);
  KnowledgeBaseVO createBase(String actor, String merchant, String name, String visibility);
  long countDocuments(String actor, String base);
  List<KnowledgeDocumentVO> documents(String actor, String base, int page, int size);
  KnowledgeDocumentVO document(String actor, String id);
  KnowledgeDocumentVO upload(
    String actor,
    String base,
    String root,
    String title,
    String filename,
    String mime,
    byte[] bytes
  );
  KnowledgeDocumentVO index(String actor, String id);
  void publish(String actor, String id);
  void withdraw(String actor, String id);
  List<KnowledgeDocumentVO> readableDocuments(String actor);
}
