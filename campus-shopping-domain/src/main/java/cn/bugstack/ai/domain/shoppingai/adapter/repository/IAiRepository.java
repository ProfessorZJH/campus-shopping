package cn.bugstack.ai.domain.shoppingai.adapter.repository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;import java.util.*;
/** AI 业务事实在 MySQL，远程检索索引不拥有权限与提案状态。 */
public interface IAiRepository {
 void createBase(KnowledgeBaseVO base,String actor);List<KnowledgeBaseVO> bases();KnowledgeBaseVO base(String id);
 KnowledgeDocumentVO createDocument(String id,String root,String base,String title,String content);KnowledgeDocumentVO document(String id);List<KnowledgeDocumentVO> documents(String base,int offset,int size);List<KnowledgeDocumentVO> visible(List<String> bases);
 long countDocuments(String base);
 void indexState(String id,String status,String error);void publish(String id);void withdraw(String id);
 void createConversation(ConversationVO conversation);ConversationVO conversation(String id);List<ConversationVO> conversations(String user);List<MessageVO> messages(String conversation,int limit);void append(MessageVO message);
 void insertProposal(ProposalVO proposal);ProposalVO proposal(String id,boolean lock);void proposalState(String id,String status,String selectionHash);List<ProposalVO> proposals(String user,String conversation);
}
