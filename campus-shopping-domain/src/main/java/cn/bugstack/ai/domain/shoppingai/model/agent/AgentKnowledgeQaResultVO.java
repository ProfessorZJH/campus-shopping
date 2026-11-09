package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;

/** 消费者知识问答的只读结果，不暴露知识文档正文或可变聚合。 */
public record AgentKnowledgeQaResultVO(
    String tool,
    String version,
    boolean readOnly,
    String query,
    String answer,
    String answerMode,
    String retrievalMode,
    String warning,
    List<AgentKnowledgeCitationVO> citations,
    long durationMs
) {
    public AgentKnowledgeQaResultVO {
        require(AgentKnowledgeQaRequestVO.TOOL.equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        require(AgentKnowledgeQaRequestVO.VERSION.equals(version), ResponseCode.ILLEGAL_PARAMETER);
        require(readOnly, ResponseCode.AUTH_FORBIDDEN);
        query = text(query, "问题", AgentKnowledgeQaRequestVO.MAX_QUESTION_LENGTH);
        answer = answer == null ? "" : answer.strip();
        require(answer.length() <= 8000, ResponseCode.REQUEST_TOO_LARGE);
        answerMode = text(answerMode, "回答模式", 32);
        retrievalMode = text(retrievalMode, "检索模式", 32);
        warning = warning == null || warning.isBlank() ? null : warning.strip();
        require(warning == null || warning.length() <= 500, ResponseCode.REQUEST_TOO_LARGE);
        require(durationMs >= 0 && durationMs <= 120_000, ResponseCode.ILLEGAL_PARAMETER);
        citations = List.copyOf(citations == null ? List.of() : citations);
        require(citations.size() <= 20, ResponseCode.REQUEST_TOO_LARGE);
    }
}
