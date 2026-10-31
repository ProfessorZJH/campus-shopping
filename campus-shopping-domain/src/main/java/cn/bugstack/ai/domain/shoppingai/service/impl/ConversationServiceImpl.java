package cn.bugstack.ai.domain.shoppingai.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Conversation 领域能力；仓储仅维护对应业务事实。 */
@Service
public class ConversationServiceImpl implements IConversationService {

  private final IConversationRepository repository;
  private final Clock clock;

  public ConversationServiceImpl(IConversationRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  public String beginTurn(String actor, String conversation) {
    String owner = UUID.randomUUID().toString();
    require(repository.claimTurn(conversation, actor, owner), ResponseCode.STATE_CONFLICT);
    return owner;
  }

  public void endTurn(String conversation, String owner) {
    repository.releaseTurn(conversation, owner);
  }

  @Transactional(rollbackFor = Exception.class)
  public void completeTurn(
    String actor,
    String conversation,
    String question,
    String answer,
    ProposalVO proposal,
    String fingerprint,
    String owner
  ) {
    require(repository.lockTurn(conversation, actor, owner), ResponseCode.STATE_CONFLICT);
    appendMessages(actor, conversation, question, answer, proposal, fingerprint);
    repository.releaseTurn(conversation, owner);
  }

  public ConversationVO conversation(String actor, String id, String question) {
    if (id == null || id.isBlank()) {
      String title = text(question, "问题", 2000);
      ConversationVO c = new ConversationVO(
        UUID.randomUUID().toString(),
        actor,
        title.substring(0, Math.min(title.length(), 100)),
        clock.instant()
      );
      repository.createConversation(c);
      return c;
    }
    ConversationVO c = repository.conversation(id);
    require(c != null && actor.equals(c.userId()), ResponseCode.NOT_FOUND);
    return c;
  }

  public List<ConversationVO> conversations(String actor) {
    return repository.conversations(actor);
  }

  public List<MessageVO> messages(String actor, String id, int limit) {
    conversation(actor, id, "历史会话");
    require(limit > 0 && limit <= 100, ResponseCode.ILLEGAL_PARAMETER);
    return repository.messages(id, limit);
  }

  @Transactional(rollbackFor = Exception.class)
  public void appendTurn(
    String actor,
    String conversation,
    String question,
    String answer,
    ProposalVO proposal,
    String fingerprint
  ) {
    String owner = beginTurn(actor, conversation);
    require(repository.lockTurn(conversation, actor, owner), ResponseCode.STATE_CONFLICT);
    appendMessages(actor, conversation, question, answer, proposal, fingerprint);
    repository.releaseTurn(conversation, owner);
  }

  private void appendMessages(
    String actor,
    String conversation,
    String question,
    String answer,
    ProposalVO proposal,
    String accessFingerprint
  ) {
    conversation(actor, conversation, question);
    repository.append(
      new MessageVO(
        UUID.randomUUID().toString(),
        conversation,
        "user",
        text(question, "问题", 2000),
        clock.instant(),
        null
      )
    );
    repository.append(
      new MessageVO(
        UUID.randomUUID().toString(),
        conversation,
        "assistant",
        text(answer, "回答", 10000),
        clock.instant(),
        accessFingerprint
      )
    );
    if (proposal != null) repository.insertProposal(proposal);
  }
}
