package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import java.time.Instant;

/** Agent Run 只读工具的持久化 Port；不直接暴露 DAO 或交易聚合。 */
public interface IAgentRunRepository {
    Instant activeTurnExpiry(String actor, String conversationId, String turnToken);
    AgentRunVO find(String runId);
    AgentRunVO findByIdempotency(String actor, String idempotencyKey);
    boolean insert(AgentRunVO run);
    boolean update(AgentRunVO expected, AgentRunVO replacement);
    AgentToolInvocationVO invocation(String runId, String invocationKey);
    boolean claimInvocation(AgentToolInvocationVO invocation);
    boolean completeInvocation(String runId, String invocationKey, String inputFingerprint, AgentToolResultVO result, Instant completedAt);
    /**
     * New envelope persistence hook. The default keeps custom M2 adapters
     * source-compatible; only the infrastructure adapter persists non-search
     * payloads in the existing output_json column.
     */
    default boolean completeInvocationEnvelope(
        String runId,
        String invocationKey,
        String inputFingerprint,
        AgentToolInvocationResultVO result,
        Instant completedAt
    ) {
        if (!"search_products".equals(result.tool())) return false;
        return completeInvocation(runId, invocationKey, inputFingerprint, result.asSearchResult(), completedAt);
    }
    boolean failInvocation(String runId, String invocationKey, String inputFingerprint, String errorCode, Instant completedAt);
}
