package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 知识发布指针是权限事实，Qdrant 里的旧向量不决定可见性。 */
@Service
public class KnowledgeCaseImpl implements IKnowledgeCase {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeCaseImpl.class);

    private final cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy egress;

    private final IKnowledgeService state;
    private final IAiEnginePort engine;
    private final IAccessService access;
    private final IUserAccountService accounts;
    private final IMerchantService merchants;

    public KnowledgeCaseImpl(
        IKnowledgeService state,
        IAiEnginePort engine,
        IAccessService access,
        IUserAccountService accounts,
        IMerchantService merchants,
        cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy egress
    ) {
        this.egress = egress;
        this.state = state;
        this.engine = engine;
        this.access = access;
        this.accounts = accounts;
        this.merchants = merchants;
    }

    private KnowledgeBaseVO manage(String actor, String id, String permission) {
        accounts.requireActive(actor);
        KnowledgeBaseVO b = state.base(id);
        if (access.isAdmin(actor)) return b;
        require(b.merchantId() != null, ResponseCode.AUTH_FORBIDDEN);
        access.requirePermission(actor, b.merchantId(), permission);
        return b;
    }

    public List<KnowledgeBaseVO> managedBases(String actor) {
        accounts.requireActive(actor);
        boolean admin = access.isAdmin(actor);
        Set<String> managed = access
            .memberships(actor)
            .stream()
            .map(m -> m.merchantId())
            .filter(id -> access.permissions(actor, id).contains("knowledge.read"))
            .collect(Collectors.toSet());
        return state
            .bases()
            .stream()
            .filter(b -> admin || managed.contains(b.merchantId()))
            .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseVO createBase(String actor, String merchant, String name, String visibility) {
        accounts.requireActive(actor);
        require(state.bases().size() < 1000, ResponseCode.ILLEGAL_PARAMETER);
        if (merchant == null || merchant.isBlank()) {
            access.requireAdmin(actor);
            merchant = null;
        } else {
            access.requirePermission(actor, merchant, "knowledge.manage");
            merchants.find(merchant);
        }
        KnowledgeBaseVO b = state.createBase(name, merchant, visibility, actor);
        access.audit(actor, "KNOWLEDGE_BASE_CREATED", b.id(), merchant, "创建知识库");
        return b;
    }

    public List<KnowledgeDocumentVO> documents(String actor, String base, int page, int size) {
        manage(actor, base, "knowledge.read");
        return state.documents(base, page, size);
    }

    public long countDocuments(String actor, String base) {
        manage(actor, base, "knowledge.read");
        return state.countDocuments(base);
    }

    public KnowledgeDocumentVO document(String actor, String id) {
        var d = state.document(id);
        manage(actor, d.baseId(), "knowledge.read");
        return d;
    }

    /** 提取和建索引发生在数据库短事务之外，不持锁等待模型/向量库。 */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NEVER)
    public KnowledgeDocumentVO upload(String actor, String base, String root, String title, String filename, String mime, byte[] bytes) {
        manage(actor, base, "knowledge.manage");
        require(bytes != null && bytes.length > 0 && bytes.length <= 2000000, ResponseCode.UPLOAD_INVALID);
        String content = engine.extract(text(filename, "文件名", 120), optional(mime, 100), bytes);
        manage(actor, base, "knowledge.manage");
        var d = state.createDocument(root == null || root.isBlank() ? null : root, base, title, content);
        return index(actor, d.id());
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NEVER)
    public KnowledgeDocumentVO index(String actor, String id) {
        var d = document(actor, id);
        manage(actor, d.baseId(), "knowledge.manage");
        var attempt = state.beginIndex(id);
        try {
            boolean external = egress.allows(d.visibility(), d.baseId(), d.merchantId());
            if (external) access.audit(actor, "AI_EXTERNAL_INDEX_REQUESTED", id, d.merchantId(), "知识嵌入范围：已批准知识版本；不记录正文");
            engine.index(id, d.title(), d.content(), external);
            require(state.completeIndex(attempt, true, ""), ResponseCode.STATE_CONFLICT);
        } catch (AppException e) {
            if (!ResponseCode.AI_UNAVAILABLE.getCode().equals(e.getCode())) throw e;
            require(state.completeIndex(attempt, false, "索引构建失败，可检查服务配置后重试"), ResponseCode.STATE_CONFLICT);
            log.error("知识索引构建失败 documentId={} diagnostic={}", id, cn.bugstack.ai.types.common.FailureDiagnostics.describe(e));
        } catch (RuntimeException e) {
            require(state.completeIndex(attempt, false, "索引构建失败，可检查服务配置后重试"), ResponseCode.STATE_CONFLICT);
            throw e;
        }
        return state.document(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void publish(String actor, String id) {
        var d = document(actor, id);
        manage(actor, d.baseId(), "knowledge.manage");
        state.publish(id);
        access.audit(actor, "KNOWLEDGE_PUBLISHED", id, d.merchantId(), "发布生效知识版本");
    }

    @Transactional(rollbackFor = Exception.class)
    public void withdraw(String actor, String id) {
        var d = document(actor, id);
        manage(actor, d.baseId(), "knowledge.manage");
        state.withdraw(id);
        access.audit(actor, "KNOWLEDGE_WITHDRAWN", id, d.merchantId(), "撤回知识版本，后续检索立即排除");
    }

    // NEVER长调用可能保留MyBatis会话缓存；每次复权用独立短只读事务重载数据库事实。
    // 返回scope后立即结束事务，远程模型调用仍不持有数据库事务。
    @Transactional(readOnly = true, propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public List<KnowledgeScopeVO> readableScope(String actor) {
        accounts.requireActive(actor);
        boolean admin = access.isAdmin(actor);
        Set<String> member = access
            .memberships(actor)
            .stream()
            .map(m -> m.merchantId())
            .filter(id -> access.permissions(actor, id).contains("knowledge.read"))
            .collect(Collectors.toSet());
        Map<String, Boolean> active = new HashMap<>();
        List<String> allowed = new ArrayList<>();
        for (KnowledgeBaseVO b : state.bases()) {
            boolean readable = switch (b.visibility()) {
                case "PUBLIC" -> b.merchantId() == null || active.computeIfAbsent(b.merchantId(), m -> "ACTIVE".equals(merchants.find(m).status()));
                case "MERCHANT_INTERNAL" -> member.contains(b.merchantId());
                case "PLATFORM_INTERNAL" -> admin;
                default -> false;
            };
            if (readable) allowed.add(b.id());
        }
        return state.visibleScope(allowed);
    }

    /** 原文仅按模型实际引用批量加载，调用者不能借此越过当前授权。 */
    @Transactional(readOnly = true, propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public List<KnowledgeDocumentVO> citationDocuments(String actor, List<String> ids) {
        require(ids != null && ids.size() <= 20, ResponseCode.ILLEGAL_PARAMETER);
        Set<String> allowed = readableScope(actor).stream().map(KnowledgeScopeVO::id).collect(Collectors.toSet());
        require(allowed.containsAll(ids), ResponseCode.KNOWLEDGE_NOT_READY);
        return state.documentsByIds(ids);
    }
}
