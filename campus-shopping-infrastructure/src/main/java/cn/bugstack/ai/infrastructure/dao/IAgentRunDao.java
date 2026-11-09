package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.AgentRunPO;
import cn.bugstack.ai.infrastructure.dao.po.AgentToolInvocationPO;
import java.time.Instant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Agent Run 鍙宸ュ叿鎵ц鐨勬寔涔呭寲鏄犲皠锛屼笉涓庢棫 AI DAO 混用。 */
@Mapper
public interface IAgentRunDao {

    Instant activeTurnExpiry(@Param("actor") String actor, @Param("conversationId") String conversationId, @Param("turnToken") String turnToken);

    AgentRunPO find(@Param("id") String id);

    AgentRunPO findByIdempotency(@Param("userId") String userId, @Param("idempotencyKey") String idempotencyKey);

    int insert(@Param("p") AgentRunPO p);

    int update(@Param("id") String id, @Param("status") String status, @Param("updatedAt") Instant updatedAt, @Param("version") long version, @Param("expectedVersion") long expectedVersion);

    AgentToolInvocationPO invocation(@Param("runId") String runId, @Param("invocationKey") String invocationKey);

    int claimInvocation(@Param("p") AgentToolInvocationPO p);

    int completeInvocation(
        @Param("runId") String runId,
        @Param("invocationKey") String invocationKey,
        @Param("inputFingerprint") String inputFingerprint,
        @Param("outputJson") String outputJson,
        @Param("completedAt") Instant completedAt
    );

    int failInvocation(
        @Param("runId") String runId,
        @Param("invocationKey") String invocationKey,
        @Param("inputFingerprint") String inputFingerprint,
        @Param("errorCode") String errorCode,
        @Param("completedAt") Instant completedAt
    );
}
