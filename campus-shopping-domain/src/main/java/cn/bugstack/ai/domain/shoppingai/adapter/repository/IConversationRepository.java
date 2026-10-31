package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IConversationRepository {
  boolean claimTurn(String id, String actor, String owner);
  boolean lockTurn(String id, String actor, String owner);
  void releaseTurn(String id, String owner);
  void createConversation(ConversationVO conversation);
  ConversationVO conversation(String id);
  List<ConversationVO> conversations(String user);
  List<MessageVO> messages(String conversation, int limit);
  void append(MessageVO message);
  void insertProposal(ProposalVO proposal);
}
