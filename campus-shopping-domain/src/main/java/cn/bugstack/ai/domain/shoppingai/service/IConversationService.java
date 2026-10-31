package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IConversationService {
  String beginTurn(String actor, String conversation);
  void endTurn(String conversation, String owner);
  void completeTurn(
    String actor,
    String conversation,
    String question,
    String answer,
    ProposalVO proposal,
    String accessFingerprint,
    String owner
  );
  ConversationVO conversation(String actor, String id, String question);
  List<ConversationVO> conversations(String actor);
  List<MessageVO> messages(String actor, String conversation, int limit);
  void appendTurn(
    String actor,
    String conversation,
    String question,
    String answer,
    ProposalVO proposal,
    String accessFingerprint
  );
}
