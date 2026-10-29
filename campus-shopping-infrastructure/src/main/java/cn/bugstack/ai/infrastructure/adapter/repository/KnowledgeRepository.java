package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
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

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class KnowledgeRepository implements IKnowledgeRepository {

    @Resource
    private IAiDao dao;

    @Resource
    private Clock clock;

    public void createBase(KnowledgeBaseVO b, String actor) {
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

    public List<KnowledgeDocumentVO> visible(List<String> bases) {
        return bases.isEmpty() ? List.of() : dao.visible(bases).stream().map(this::document).toList();
    }

    public void indexState(String id, String status, String error) {
        require(dao.indexState(id, status, error) == 1, ResponseCode.NOT_FOUND);
    }

    public cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate lockPublication(String id) {
        KnowledgeDocumentPO d = dao.document(id);
        require(d != null, ResponseCode.NOT_FOUND);
        // 创建版本、发布、撤回统一先锁根，再重读文档，避免旧版本越过最新版本发布。
        DocumentRootPO r = dao.root(d.getRootId());
        if (r == null) throw new IllegalStateException("知识文档根丢失");
        d = dao.document(id);
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
