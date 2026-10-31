package cn.bugstack.ai.domain.shoppingai.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Knowledge 领域能力；仓储仅维护对应业务事实。 */
@Service
public class KnowledgeServiceImpl implements IKnowledgeService {

  private final IKnowledgeRepository repository;
  private final Clock clock;

  public KnowledgeServiceImpl(IKnowledgeRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  @Transactional(rollbackFor = Exception.class)
  public KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor) {
    require(
      visibility != null &&
        (merchant == null
          ? Set.of("PUBLIC", "PLATFORM_INTERNAL").contains(visibility)
          : Set.of("PUBLIC", "MERCHANT_INTERNAL").contains(visibility)),
      ResponseCode.ILLEGAL_PARAMETER
    );
    KnowledgeBaseVO b = new KnowledgeBaseVO(
      UUID.randomUUID().toString(),
      text(name, "知识库名称", 100),
      merchant,
      visibility
    );
    repository.createBase(b, actor);
    return b;
  }

  public List<KnowledgeBaseVO> bases() {
    return repository.bases();
  }

  public KnowledgeBaseVO base(String id) {
    var b = repository.base(id);
    require(b != null, ResponseCode.NOT_FOUND);
    return b;
  }

  @Transactional(rollbackFor = Exception.class)
  public KnowledgeDocumentVO createDocument(
    String root,
    String base,
    String title,
    String content
  ) {
    base(base);
    return repository.createDocument(
      UUID.randomUUID().toString(),
      root,
      base,
      text(title, "文档标题", 120),
      text(content, "文档正文", 100000)
    );
  }

  public KnowledgeDocumentVO document(String id) {
    var d = repository.document(id);
    require(d != null, ResponseCode.NOT_FOUND);
    return d;
  }

  public List<KnowledgeDocumentVO> documents(String base, int page, int size) {
    return repository.documents(base, offset(page, size), size);
  }

  public long countDocuments(String base) {
    return repository.countDocuments(base);
  }

  public List<KnowledgeDocumentVO> visible(List<String> bases) {
    require(bases.size() <= 1000, ResponseCode.ILLEGAL_PARAMETER);
    return repository.visible(bases);
  }

  public void indexState(String id, String status, String error) {
    require(Set.of("PENDING", "READY", "FAILED").contains(status), ResponseCode.ILLEGAL_PARAMETER);
    repository.indexState(id, status, optional(error, 500));
  }

  @Transactional(rollbackFor = Exception.class)
  public void publish(String id) {
    var publication = repository.lockPublication(id);
    publication.publish();
    repository.savePublication(publication);
  }

  @Transactional(rollbackFor = Exception.class)
  public void withdraw(String id) {
    var publication = repository.lockPublication(id);
    publication.withdraw();
    repository.savePublication(publication);
  }
}
