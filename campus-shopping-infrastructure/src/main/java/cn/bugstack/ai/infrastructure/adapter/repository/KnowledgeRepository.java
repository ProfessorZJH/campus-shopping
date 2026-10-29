package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.DocumentRootPO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeBasePO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeDocumentPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import static cn.bugstack.ai.types.common.Checks.require;

/**
 * 知识库版本与激活指针在 MySQL 中保持一致。
 * 只有发布指针指向 READY 的最新文档才可见，外部向量索引不持有权限真值。
 */
@Repository
public class KnowledgeRepository implements IKnowledgeRepository {
    @Resource private IAiDao dao;
    @Resource private Clock clock;

    @Override
    public void createBase(KnowledgeBaseVO base, String actor) {
        dao.baseInsert(KnowledgeBasePO.builder().id(base.id()).name(base.name())
                .merchantId(base.merchantId()).visibility(base.visibility()).build(), actor);
    }

    @Override
    public List<KnowledgeBaseVO> bases() {
        return dao.bases().stream().map(this::convertBase).toList();
    }

    @Override
    public KnowledgeBaseVO base(String id) { return convertBase(dao.base(id)); }

    @Override
    public KnowledgeDocumentVO createDocument(String id, String root, String base,
                                               String title, String content) {
        if (root == null) {
            root = UUID.randomUUID().toString();
            dao.rootInsert(root, base);
        }
        DocumentRootPO version = dao.root(root);
        require(version != null && version.getBaseId().equals(base), ResponseCode.NOT_FOUND);
        dao.incrementVersion(root);
        dao.documentInsert(KnowledgeDocumentPO.builder()
                .id(id).rootId(root).baseId(base).version(version.getVersionCounter() + 1)
                .title(title).content(content).createdAt(clock.instant()).build());
        return document(id);
    }

    @Override
    public KnowledgeDocumentVO document(String id) { return convertDocument(dao.document(id)); }

    @Override
    public List<KnowledgeDocumentVO> documents(String base, int offset, int size) {
        return dao.documents(base, offset, size).stream().map(this::convertDocument).toList();
    }

    @Override
    public long countDocuments(String base) { return dao.countDocuments(base); }

    @Override
    public List<KnowledgeDocumentVO> visible(List<String> bases) {
        return bases.isEmpty() ? List.of()
                : dao.visible(bases).stream().map(this::convertDocument).toList();
    }

    @Override
    public void indexState(String id, String status, String error) {
        require(dao.indexState(id, status, error) == 1, ResponseCode.NOT_FOUND);
    }

    @Override
    public void publish(String id) {
        KnowledgeDocumentPO document = dao.document(id);
        require(document != null, ResponseCode.NOT_FOUND);
        DocumentRootPO root = dao.root(document.getRootId());
        document = dao.document(id);
        require("READY".equals(document.getIndexStatus()), ResponseCode.KNOWLEDGE_NOT_READY);
        require(document.getVersion().equals(root.getVersionCounter()), ResponseCode.STATE_CONFLICT);
        if (root.getActiveDocumentId() != null && !root.getActiveDocumentId().equals(id)) {
            dao.documentState(root.getActiveDocumentId(), "WITHDRAWN");
        }
        dao.documentState(id, "PUBLISHED");
        dao.activeDocument(root.getId(), id);
    }

    @Override
    public void withdraw(String id) {
        KnowledgeDocumentPO document = dao.document(id);
        require(document != null, ResponseCode.NOT_FOUND);
        DocumentRootPO root = dao.root(document.getRootId());
        if (id.equals(root.getActiveDocumentId())) {
            dao.activeDocument(root.getId(), null);
        }
        dao.documentState(id, "WITHDRAWN");
    }

    private KnowledgeBaseVO convertBase(KnowledgeBasePO po) {
        return po == null ? null : new KnowledgeBaseVO(
                po.getId(), po.getName(), po.getMerchantId(), po.getVisibility());
    }

    private KnowledgeDocumentVO convertDocument(KnowledgeDocumentPO po) {
        return po == null ? null : new KnowledgeDocumentVO(po.getId(), po.getRootId(),
                po.getBaseId(), po.getTitle(), po.getMerchantId(), po.getVisibility(),
                po.getVersion(), po.getStatus(), po.getIndexStatus(),
                po.getContent(), po.getError(), po.getCreatedAt());
    }
}
