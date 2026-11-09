package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.types.enums.ResponseCode;

/** 已通过 Java 知识权限和版本校验的有限引用摘要。 */
public record AgentKnowledgeCitationVO(String documentId, String title, String snippet, double score) {

    public AgentKnowledgeCitationVO {
        documentId = text(documentId, "文档", 64);
        title = text(title, "标题", 200);
        snippet = text(snippet, "引用", 500);
        require(Double.isFinite(score) && score >= 0, ResponseCode.ILLEGAL_PARAMETER);
    }
}
