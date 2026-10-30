package cn.bugstack.ai.domain.shoppingai.service.policy;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgePublicationVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.Objects;

/**
 * 知识文档发布领域规则。
 *
 * 向量库索引成功并不自动生效；必须由 MySQL 中已锁定的最新版指针决定是否发布。
 * 当前文档被重新索引、存在新版本时，禁止用旧版本覆盖已发布内容。
 */
public final class KnowledgePublicationPolicy {

    private KnowledgePublicationPolicy() {}

    /** READY 且与文档根最新版本一致，才允许切换生效版本。 */
    public static void requirePublishable(KnowledgePublicationVO version) {
        Objects.requireNonNull(version);
        require("READY".equals(version.indexStatus()), ResponseCode.KNOWLEDGE_NOT_READY);
        require(version.documentVersion() == version.latestVersion(), ResponseCode.STATE_CONFLICT);
    }

    /** 撤回非当前生效版本不能误清空其他文档的发布指针。 */
    public static boolean isActive(KnowledgePublicationVO version) {
        Objects.requireNonNull(version);
        return version.documentId().equals(version.activeDocumentId());
    }
}
