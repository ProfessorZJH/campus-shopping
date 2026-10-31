package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/**
 * 本地知识元数据和对话持久化，不直接调用 Python、模型或 Qdrant。
 */
@Repository
public class AiRepository implements IAiRepository {

  @Resource
  private IAiDao dao;

  @Resource
  private ObjectMapper mapper;

  @Resource
  private Clock clock;

  public void createBase(KnowledgeBaseVO b, String actor) {
    require(dao.reserveBaseQuota() == 1, ResponseCode.ILLEGAL_PARAMETER);
    dao.baseInsert(
      KnowledgeBasePO.builder()
        .id(b.id())
        .name(b.name())
        .merchantId(b.merchantId())
        .visibility(b.visibility())
        .build(),
      actor
    );
  }

  public List<KnowledgeBaseVO> bases() {
    return dao.bases().stream().map(this::base).toList();
  }

  public KnowledgeBaseVO base(String id) {
    return base(dao.base(id));
  }

  public KnowledgeDocumentVO createDocument(
    String id,
    String root,
    String base,
    String title,
    String content
  ) {
    if (root == null) {
      root = UUID.randomUUID().toString();
      dao.rootInsert(root, base);
    }
    DocumentRootPO r = dao.root(root);
    require(r != null && r.getBaseId().equals(base), ResponseCode.NOT_FOUND);
    dao.incrementVersion(root);
    dao.documentInsert(
      KnowledgeDocumentPO.builder()
        .id(id)
        .rootId(root)
        .baseId(base)
        .version(r.getVersionCounter() + 1)
        .title(title)
        .content(content)
        .createdAt(clock.instant())
        .build()
    );
    return document(id);
  }

  public KnowledgeDocumentVO document(String id) {
    return document(dao.document(id));
  }

  public List<KnowledgeDocumentVO> documents(String base, int offset, int size) {
    return dao.documents(base, offset, size).stream().map(this::document).toList();
  }

  public long countDocuments(String base) {
    return dao.countDocuments(base);
  }

  public List<KnowledgeDocumentVO> visible(List<String> bases) {
    return bases.isEmpty() ? List.of() : dao.visible(bases).stream().map(this::document).toList();
  }

  public void indexState(String id, String status, String error) {
    require(dao.indexState(id, status, error) == 1, ResponseCode.NOT_FOUND);
  }

  public cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate lockPublication(
    String id
  ) {
    KnowledgeDocumentPO d = dao.document(id);
    require(d != null, ResponseCode.NOT_FOUND);
    // 创建版本、发布、撤回统一先锁根，再重读文档，避免旧版本越过最新版本发布。
    DocumentRootPO r = dao.root(d.getRootId());
    if (r == null) throw new IllegalStateException("知识文档根丢失");
    d = dao.document(id);
    return new cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate(
      document(d),
      r.getVersionCounter(),
      r.getActiveDocumentId()
    );
  }

  public void savePublication(
    cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate publication
  ) {
    String id = publication.document().id();
    if (
      publication.previousActiveId() != null &&
      !publication.previousActiveId().equals(publication.activeId()) &&
      "PUBLISHED".equals(publication.status())
    ) {
      require(
        dao.documentState(publication.previousActiveId(), "WITHDRAWN") == 1,
        ResponseCode.STATE_CONFLICT
      );
    }
    require(dao.documentState(id, publication.status()) == 1, ResponseCode.STATE_CONFLICT);
    require(
      dao.activeDocument(publication.document().rootId(), publication.activeId()) == 1,
      ResponseCode.STATE_CONFLICT
    );
  }

  public boolean claimTurn(String id, String actor, String owner) {
    return dao.claimTurn(id, actor, owner) == 1;
  }

  public boolean lockTurn(String id, String actor, String owner) {
    return dao.lockTurn(id, actor, owner) != null;
  }

  public void releaseTurn(String id, String owner) {
    dao.releaseTurn(id, owner);
  }

  public void createConversation(ConversationVO c) {
    dao.conversationInsert(
      ConversationPO.builder()
        .id(c.id())
        .userId(c.userId())
        .title(c.title())
        .createdAt(c.createdAt())
        .build()
    );
  }

  public ConversationVO conversation(String id) {
    return conversation(dao.conversation(id));
  }

  public List<ConversationVO> conversations(String user) {
    return dao.conversations(user).stream().map(this::conversation).toList();
  }

  public List<MessageVO> messages(String id, int limit) {
    return dao
      .messages(id, limit)
      .stream()
      .map(p ->
        new MessageVO(
          p.getId(),
          p.getConversationId(),
          p.getRole(),
          p.getContent(),
          p.getCreatedAt(),
          p.getAccessFingerprint()
        )
      )
      .toList();
  }

  public void append(MessageVO m) {
    dao.messageInsert(
      MessagePO.builder()
        .id(m.id())
        .conversationId(m.conversationId())
        .role(m.role())
        .content(m.content())
        .createdAt(m.createdAt())
        .accessFingerprint(m.accessFingerprint())
        .build()
    );
  }

  public void insertProposal(ProposalVO p) {
    try {
      dao.proposalInsert(
        ProposalPO.builder()
          .id(p.id())
          .userId(p.userId())
          .conversationId(p.conversationId())
          .status(p.status())
          .itemsJson(mapper.writeValueAsString(p.items()))
          .selectionHash(p.selectionHash())
          .expiresAt(p.expiresAt())
          .build()
      );
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException("提案序列化失败", e);
    }
  }

  public ProposalVO proposal(String id, boolean lock) {
    return proposal(dao.proposal(id, lock));
  }

  public void proposalState(String id, String status, String hash) {
    require(dao.proposalState(id, status, hash) == 1, ResponseCode.STATE_CONFLICT);
  }

  public List<ProposalVO> proposals(String user, String conversation) {
    return dao.proposals(user, conversation).stream().map(this::proposal).toList();
  }

  private KnowledgeBaseVO base(KnowledgeBasePO p) {
    return p == null
      ? null
      : new KnowledgeBaseVO(p.getId(), p.getName(), p.getMerchantId(), p.getVisibility());
  }

  private KnowledgeDocumentVO document(KnowledgeDocumentPO p) {
    return p == null
      ? null
      : new KnowledgeDocumentVO(
          p.getId(),
          p.getRootId(),
          p.getBaseId(),
          p.getTitle(),
          p.getMerchantId(),
          p.getVisibility(),
          p.getVersion(),
          p.getStatus(),
          p.getIndexStatus(),
          p.getContent(),
          p.getError(),
          p.getCreatedAt()
        );
  }

  private ConversationVO conversation(ConversationPO p) {
    return p == null
      ? null
      : new ConversationVO(p.getId(), p.getUserId(), p.getTitle(), p.getCreatedAt());
  }

  private ProposalVO proposal(ProposalPO p) {
    if (p == null) return null;
    try {
      return new ProposalVO(
        p.getId(),
        p.getUserId(),
        p.getConversationId(),
        p.getStatus(),
        mapper.readValue(p.getItemsJson(), new TypeReference<List<ProposalItemVO>>() {}),
        p.getSelectionHash(),
        p.getExpiresAt()
      );
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException("提案数据损坏", e);
    }
  }
}
