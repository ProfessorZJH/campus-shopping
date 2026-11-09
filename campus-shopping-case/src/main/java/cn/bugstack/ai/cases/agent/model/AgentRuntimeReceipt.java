package cn.bugstack.ai.cases.agent.model;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import java.util.Objects;

/** Runtime 编排结果；只包含已校验的 Runtime 状态，不暴露凭据或下游正文。 */
public record AgentRuntimeReceipt(
    String runId,
    AgentRuntimeStatusVO status,
    String answer,
    String evidenceStatus,
    String errorCode,
    int rounds,
    AgentRuntimeResultVO lastResult
) {
    public AgentRuntimeReceipt {
        Objects.requireNonNull(runId);
        Objects.requireNonNull(status);
    }
}
