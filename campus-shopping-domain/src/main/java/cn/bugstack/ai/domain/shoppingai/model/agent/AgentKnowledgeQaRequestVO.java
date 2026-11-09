package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.types.enums.ResponseCode;

/** 消费者知识问答工具请求；只描述问题，不携带文档或权限覆盖字段。 */
public record AgentKnowledgeQaRequestVO(String tool, String version, String question) {

    public static final String TOOL = "knowledge_qa";
    public static final String VERSION = "1.0";
    public static final int MAX_QUESTION_LENGTH = 1000;

    public AgentKnowledgeQaRequestVO(String question) {
        this(TOOL, VERSION, question);
    }

    public AgentKnowledgeQaRequestVO {
        require(TOOL.equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        require(VERSION.equals(version), ResponseCode.ILLEGAL_PARAMETER);
        question = text(question, "问题", MAX_QUESTION_LENGTH);
    }
}
