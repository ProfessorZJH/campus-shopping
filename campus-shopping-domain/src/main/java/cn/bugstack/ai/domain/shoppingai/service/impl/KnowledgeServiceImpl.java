package cn.bugstack.ai.domain.shoppingai.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexAttemptVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexStatusEnumVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Knowledge 领域能力；仓储仅维护对应业务事实。 */
@Service
public class KnowledgeServiceImpl implements IKnowledgeService {

    private final IKnowledgeRepository repository;

    public KnowledgeServiceImpl(IKnowledgeRepository repository) {
        this.repository = repository;
    }

    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseVO createBase(String name, String merchant, String visibility, String actor) {
        require(
            visibility != null &&
                (merchant == null ? Set.of("PUBLIC", "PLATFORM_INTERNAL").contains(visibility) : Set.of("PUBLIC", "MERCHANT_INTERNAL").contains(visibility)),
            ResponseCode.ILLEGAL_PARAMETER
        );
        KnowledgeBaseVO b = new KnowledgeBaseVO(UUID.randomUUID().toString(), text(name, "知识库名称", 100), merchant, visibility);
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
    public KnowledgeDocumentVO createDocument(String root, String base, String title, String content) {
        base(base);
        return repository.createDocument(UUID.randomUUID().toString(), root, base, text(title, "文档标题", 120), text(content, "文档正文", 100000));
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

    public List<KnowledgeScopeVO> visibleScope(List<String> bases) {
        List<KnowledgeScopeVO> scope = repository.visibleScope(bases);
        require(scope.size() <= 1000, ResponseCode.KNOWLEDGE_SCOPE_TOO_LARGE);
        return scope;
    }

    public List<KnowledgeDocumentVO> documentsByIds(List<String> ids) {
        require(ids != null && ids.size() <= 20 && ids.stream().allMatch(id -> id != null && !id.isBlank()), ResponseCode.ILLEGAL_PARAMETER);
        return ids.isEmpty() ? List.of() : repository.documentsByIds(ids.stream().distinct().toList());
    }

    public KnowledgeIndexAttemptVO beginIndex(String id) {
        var attempt = new KnowledgeIndexAttemptVO(id, UUID.randomUUID().toString());
        repository.beginIndex(id, attempt.token());
        return attempt;
    }

    public boolean completeIndex(KnowledgeIndexAttemptVO attempt, boolean ready, String error) {
        var status = ready ? KnowledgeIndexStatusEnumVO.READY : KnowledgeIndexStatusEnumVO.FAILED;
        return repository.completeIndex(attempt, status.getCode(), optional(error, 500));
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
