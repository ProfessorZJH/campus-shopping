package cn.bugstack.ai.domain.shoppingai.service;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;import java.util.*;
/** 知识发布、用户会话和提案生命周期的领域能力。 */
public interface IAiStateService {
 KnowledgeBaseVO createBase(String name,String merchant,String visibility,String actor);List<KnowledgeBaseVO> bases();KnowledgeBaseVO base(String id);
 KnowledgeDocumentVO createDocument(String root,String base,String title,String content);KnowledgeDocumentVO document(String id);List<KnowledgeDocumentVO> documents(String base,int page,int size);List<KnowledgeDocumentVO> visible(List<String> bases);
 long countDocuments(String base);
 void indexState(String id,String status,String error);void publish(String id);void withdraw(String id);
 ConversationVO conversation(String actor,String id,String question);List<ConversationVO> conversations(String actor);List<MessageVO> messages(String actor,String conversation,int limit);
 void appendTurn(String actor,String conversation,String question,String answer,ProposalVO proposal,String accessFingerprint);
 ProposalVO proposal(String actor,String id,boolean lock);List<ProposalVO> proposals(String actor,String conversation);void confirm(String id,String selectionHash);void reject(String actor,String id);
}
