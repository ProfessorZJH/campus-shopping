package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;

/** Agent Run 的不可变持久化快照；不持有交易聚合。 */
public record AgentRunVO(
    String id,
    String userId,
    String idempotencyKey,
    String capabilityTokenHash,
    AgentScopeVO scope,
    Set<String> allowedTools,
    AgentRunStatusVO status,
    Instant createdAt,
    Instant updatedAt,
    long version
) {
    public AgentRunVO {
        require(id != null && !id.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(userId != null && !userId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(idempotencyKey != null && !idempotencyKey.isBlank() && idempotencyKey.length() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        require(capabilityTokenHash != null && capabilityTokenHash.length() == 64, ResponseCode.ILLEGAL_PARAMETER);
        if (scope == null || !userId.equals(scope.userId())) throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.AUTH_FORBIDDEN);
        allowedTools = Set.copyOf(allowedTools == null ? Set.of() : allowedTools);
        require(status != null, ResponseCode.ILLEGAL_PARAMETER);
        require(createdAt != null && updatedAt != null && version >= 0, ResponseCode.STATE_CONFLICT);
    }

    public boolean usable(Clock clock) {
        return (status == AgentRunStatusVO.CREATED || status == AgentRunStatusVO.RUNNING) && !scope.expired(clock);
    }

    public AgentRunVO running(Instant now) {
        require(status == AgentRunStatusVO.CREATED, ResponseCode.STATE_CONFLICT);
        return new AgentRunVO(id, userId, idempotencyKey, capabilityTokenHash, scope, allowedTools, AgentRunStatusVO.RUNNING, createdAt, now, version + 1);
    }

    public AgentRunVO completed(Instant now) {
        require(status == AgentRunStatusVO.RUNNING, ResponseCode.STATE_CONFLICT);
        return new AgentRunVO(id, userId, idempotencyKey, capabilityTokenHash, scope, allowedTools, AgentRunStatusVO.COMPLETED, createdAt, now, version + 1);
    }

    public AgentRunVO failed(Instant now) {
        require(status == AgentRunStatusVO.RUNNING, ResponseCode.STATE_CONFLICT);
        return new AgentRunVO(id, userId, idempotencyKey, capabilityTokenHash, scope, allowedTools, AgentRunStatusVO.FAILED, createdAt, now, version + 1);
    }
}
