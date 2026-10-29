package cn.bugstack.ai.domain.shoppingai.service.impl;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationPolicy;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgePublicationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeStateService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static cn.bugstack.ai.types.common.Checks.offset;
import static cn.bugstack.ai.types.common.Checks.optional;
import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 知识库元数据与版本生命周期。
 * 远程文件解析、Embedding、向量写入由 Case 通过 AI Engine Port 调用，不能在事务里等待模型。
 */
@Service
public class KnowledgeStateServiceImpl implements IKnowledgeStateService {
    private final IKnowledgeRepository repository;

    public KnowledgeStateServiceImpl(IKnowledgeRepository repository) {
        this.repository = repository;
    }

    @Override
    public KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor) {
        require(merchant == null
                        ? Set.of("PUBLIC", "PLATFORM_INTERNAL").contains(visibility)
                        : Set.of("PUBLIC", "MERCHANT_INTERNAL").contains(visibility),
                ResponseCode.ILLEGAL_PARAMETER);
        KnowledgeBaseVO base = new KnowledgeBaseVO(UUID.randomUUID().toString(),
                text(name, "知识库名称", 100), merchant, visibility);
        repository.createBase(base, actor);
        return base;
    }

    @Override
    public List<KnowledgeBaseVO> bases() { return repository.bases(); }

    @Override
    public KnowledgeBaseVO base(String id) {
        KnowledgeBaseVO base = repository.base(id);
        require(base != null, ResponseCode.NOT_FOUND);
        return base;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeDocumentVO createDocument(String root, String base, String title, String content) {
        base(base);
        return repository.createDocument(UUID.randomUUID().toString(), root, base,
                text(title, "文档标题", 120), text(content, "文档正文", 100000));
    }

    @Override
    public KnowledgeDocumentVO document(String id) {
        KnowledgeDocumentVO doc = repository.document(id);
        require(doc != null, ResponseCode.NOT_FOUND);
        return doc;
    }

    @Override
    public List<KnowledgeDocumentVO> documents(String base, int page, int size) {
        return repository.documents(base, offset(page, size), size);
    }

    @Override
    public long countDocuments(String base) { return repository.countDocuments(base); }

    @Override
    public List<KnowledgeDocumentVO> visible(List<String> bases) {
        require(bases != null && bases.size() <= 1000, ResponseCode.ILLEGAL_PARAMETER);
        return repository.visible(bases);
    }

    @Override
    public void indexState(String id, String status, String error) {
        require(Set.of("PENDING", "READY", "FAILED").contains(status), ResponseCode.ILLEGAL_PARAMETER);
        repository.indexState(id, status, optional(error, 500));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void publish(String id) {
        // 仓储在同一事务内锁住文档根，防止发布过程中被新的版本越过。
        KnowledgePublicationVO snapshot = repository.lockPublication(id);
        KnowledgePublicationPolicy.requirePublishable(snapshot);
        repository.publish(snapshot);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void withdraw(String id) {
        KnowledgePublicationVO snapshot = repository.lockPublication(id);
        // 旧版本撤回不能清空另一个新版本的生效指针。
        repository.withdraw(snapshot, KnowledgePublicationPolicy.isActive(snapshot));
    }
}
