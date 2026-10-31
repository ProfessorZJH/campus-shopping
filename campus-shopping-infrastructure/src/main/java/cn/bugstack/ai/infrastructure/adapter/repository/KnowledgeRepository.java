package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexAttemptVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.DocumentRootPO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeBasePO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeDocumentPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class KnowledgeRepository implements IKnowledgeRepository {

    @Resource
    private IAiDao dao;

    @Resource
    private Clock clock;

    public void createBase(KnowledgeBaseVO b, String actor) {
        require(dao.reserveBaseQuota() == 1, ResponseCode.ILLEGAL_PARAMETER);
        dao.baseInsert(KnowledgeBasePO.builder().id(b.id()).name(b.name()).merchantId(b.merchantId()).visibility(b.visibility()).build(), actor);
    }

    public List<KnowledgeBaseVO> bases() {
        return dao.bases().stream().map(this::base).toList();
    }

    public KnowledgeBaseVO base(String id) {
        return base(dao.base(id));
    }

    public KnowledgeDocumentVO createDocument(String id, String root, String base, String title, String content) {
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

    public List<KnowledgeScopeVO> visibleScope(List<String> bases) {
        if (bases.isEmpty()) return List.of();
        var scope = new java.util.ArrayList<KnowledgeScopeVO>();
        for (int start = 0; start < bases.size() && scope.size() <= 1000; start += 100) {
            dao.visibleScope(bases.subList(start, Math.min(start + 100, bases.size()))).forEach(p ->
                scope.add(new KnowledgeScopeVO(p.getId(), p.getTitle(), p.getVisibility(), p.getBaseId(), p.getMerchantId()))
            );
        }
        return scope;
    }

    public List<KnowledgeDocumentVO> documentsByIds(List<String> ids) {
        return ids.isEmpty() ? List.of() : dao.documentsByIds(ids).stream().map(this::document).toList();
    }

    public void beginIndex(String id, String attempt) {
        require(dao.beginIndex(id, attempt) == 1, ResponseCode.STATE_CONFLICT);
    }

    public void reserveDocumentQuota(String base, long bytes, int maxDocuments, long maxBytes) {
        String owner = quotaOwner(base);
        dao.ensureUsage(owner);
        require(dao.reserveDocumentQuota(owner, bytes, maxDocuments, maxBytes) == 1, ResponseCode.ILLEGAL_PARAMETER);
    }

    public void reserveIndexQuota(String id, int maxPerMinute, int maxConcurrent) {
        var document = dao.document(id);
        require(document != null, ResponseCode.NOT_FOUND);
        String owner = quotaOwner(document.getBaseId());
        dao.ensureUsage(owner);
        dao.lockUsage(owner);
        require(dao.activeIndexes(owner).size() < maxConcurrent, ResponseCode.STATE_CONFLICT);
        require(dao.reserveIndexRate(owner, maxPerMinute) == 1, ResponseCode.AUTH_RATE_LIMITED);
    }

    private String quotaOwner(String base) {
        var knowledgeBase = dao.base(base);
        require(knowledgeBase != null, ResponseCode.NOT_FOUND);
        return knowledgeBase.getMerchantId() == null ? "__platform__" : knowledgeBase.getMerchantId();
    }

    public boolean completeIndex(KnowledgeIndexAttemptVO attempt, String status, String error) {
        return dao.completeIndex(attempt.documentId(), attempt.token(), status, error) == 1;
    }

    public cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate lockPublication(String id) {
        KnowledgeDocumentPO d = dao.document(id);
        require(d != null, ResponseCode.NOT_FOUND);
        // 创建版本、发布、撤回统一先锁根，再重读文档，避免旧版本越过最新版本发布。
        DocumentRootPO r = dao.root(d.getRootId());
        if (r == null) throw new IllegalStateException("知识文档根丢失");
        d = dao.lockDocument(id);
        return new cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate(document(d), r.getVersionCounter(), r.getActiveDocumentId());
    }

    public void savePublication(cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate publication) {
        String id = publication.document().id();
        if (
            publication.previousActiveId() != null && !publication.previousActiveId().equals(publication.activeId()) && "PUBLISHED".equals(publication.status())
        ) {
            require(dao.documentState(publication.previousActiveId(), "WITHDRAWN") == 1, ResponseCode.STATE_CONFLICT);
        }
        require(dao.documentState(id, publication.status()) == 1, ResponseCode.STATE_CONFLICT);
        require(dao.activeDocument(publication.document().rootId(), publication.activeId()) == 1, ResponseCode.STATE_CONFLICT);
    }

    private KnowledgeBaseVO base(KnowledgeBasePO p) {
        return p == null ? null : new KnowledgeBaseVO(p.getId(), p.getName(), p.getMerchantId(), p.getVisibility());
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
}
