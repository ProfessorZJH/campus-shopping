package cn.bugstack.ai.domain.shoppingai.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.types.enums.ResponseCode;

/** 一个文档根的发布行为。版本计数与当前指针由仓储在同一根行锁下重建。 */
public final class KnowledgePublicationAggregate {

    private final KnowledgeDocumentVO document;
    private final int latestVersion;
    private final String previousActiveId;
    private String activeId;
    private KnowledgeDocumentStatusEnumVO status;

    public KnowledgePublicationAggregate(KnowledgeDocumentVO document, int latestVersion, String activeId) {
        this.document = java.util.Objects.requireNonNull(document);
        this.latestVersion = latestVersion;
        this.previousActiveId = activeId;
        this.activeId = activeId;
        this.status = KnowledgeDocumentStatusEnumVO.fromCode(document.status());
    }

    public void publish() {
        cn.bugstack.ai.domain.shoppingai.service.policy.KnowledgePublicationPolicy.requirePublishable(
            new KnowledgePublicationVO(document.id(), document.rootId(), activeId, document.version(), latestVersion, document.indexStatus())
        );
        activeId = document.id();
        status = KnowledgeDocumentStatusEnumVO.PUBLISHED;
    }

    public void withdraw() {
        if (document.id().equals(activeId)) activeId = null;
        status = KnowledgeDocumentStatusEnumVO.WITHDRAWN;
    }

    public KnowledgeDocumentVO document() {
        return document;
    }

    public String previousActiveId() {
        return previousActiveId;
    }

    public String activeId() {
        return activeId;
    }

    public String status() {
        return status.getCode();
    }
}
