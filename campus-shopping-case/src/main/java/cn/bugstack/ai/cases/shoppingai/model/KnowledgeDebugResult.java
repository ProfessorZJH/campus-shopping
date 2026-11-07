package cn.bugstack.ai.cases.shoppingai.model;

import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import java.util.List;

/** 只读 RAG 调试结果，内容已在服务端完成授权与版本复核。 */
public record KnowledgeDebugResult(
    String query,
    String retrievalMode,
    String answerMode,
    String answerPreview,
    String warning,
    List<AiCitationVO> hits,
    Long latencyMs
) {}
