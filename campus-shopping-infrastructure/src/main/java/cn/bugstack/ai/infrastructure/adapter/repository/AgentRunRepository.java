package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.infrastructure.dao.IAgentRunDao;
import cn.bugstack.ai.infrastructure.dao.po.AgentRunPO;
import cn.bugstack.ai.infrastructure.dao.po.AgentToolInvocationPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.time.Instant;
import java.util.Set;
import org.springframework.stereotype.Repository;

/** Agent Run 持久化适配器；只保存受控快照和工具调用幂等状态。 */
@Repository
public class AgentRunRepository implements IAgentRunRepository {

    @Resource
    private IAgentRunDao dao;

    @Resource
    private ObjectMapper mapper;

    @Override
    public Instant activeTurnExpiry(String actor, String conversationId, String turnToken) {
        return dao.activeTurnExpiry(actor, conversationId, turnToken);
    }

    @Override
    public AgentRunVO find(String runId) {
        return toRun(dao.find(runId));
    }

    @Override
    public AgentRunVO findByIdempotency(String actor, String idempotencyKey) {
        return toRun(dao.findByIdempotency(actor, idempotencyKey));
    }

    @Override
    public boolean insert(AgentRunVO run) {
        return dao.insert(
            AgentRunPO.builder()
                .id(run.id())
                .userId(run.userId())
                .idempotencyKey(run.idempotencyKey())
                .capabilityTokenHash(run.capabilityTokenHash())
                .conversationId(run.scope().conversationId())
                .turnToken(run.scope().turnToken())
                .scopeJson(write(run.scope()))
                .toolsJson(write(run.allowedTools()))
                .status(run.status().name())
                .version(run.version())
                .createdAt(run.createdAt())
                .updatedAt(run.updatedAt())
                .build()
        ) == 1;
    }

    @Override
    public boolean update(AgentRunVO expected, AgentRunVO replacement) {
        return dao.update(replacement.id(), replacement.status().name(), replacement.updatedAt(), replacement.version(), expected.version()) == 1;
    }

    @Override
    public AgentToolInvocationVO invocation(String runId, String invocationKey) {
        return toInvocation(dao.invocation(runId, invocationKey));
    }

    @Override
    public boolean claimInvocation(AgentToolInvocationVO invocation) {
        return dao.claimInvocation(
            AgentToolInvocationPO.builder()
                .id(invocation.id())
                .runId(invocation.runId())
                .invocationKey(invocation.invocationKey())
                .toolName(invocation.toolName())
                .inputFingerprint(invocation.inputFingerprint())
                .status(invocation.status())
                .inputJson("{}")
                .createdAt(invocation.createdAt())
                .build()
        ) == 1;
    }

    @Override
    public boolean completeInvocation(String runId, String invocationKey, String inputFingerprint, AgentToolResultVO result, Instant completedAt) {
        return dao.completeInvocation(runId, invocationKey, inputFingerprint, write(result), completedAt) == 1;
    }

    @Override
    public boolean completeInvocationEnvelope(
        String runId,
        String invocationKey,
        String inputFingerprint,
        AgentToolInvocationResultVO result,
        Instant completedAt
    ) {
        return dao.completeInvocation(runId, invocationKey, inputFingerprint, write(result), completedAt) == 1;
    }

    @Override
    public boolean failInvocation(String runId, String invocationKey, String inputFingerprint, String errorCode, Instant completedAt) {
        return dao.failInvocation(runId, invocationKey, inputFingerprint, errorCode, completedAt) == 1;
    }

    private AgentRunVO toRun(AgentRunPO p) {
        if (p == null) return null;
        return new AgentRunVO(
            p.getId(),
            p.getUserId(),
            p.getIdempotencyKey(),
            p.getCapabilityTokenHash(),
            read(p.getScopeJson(), AgentScopeVO.class),
            read(p.getToolsJson(), new TypeReference<Set<String>>() {}),
            cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO.valueOf(p.getStatus()),
            p.getCreatedAt(),
            p.getUpdatedAt(),
            p.getVersion()
        );
    }

    private AgentToolInvocationVO toInvocation(AgentToolInvocationPO p) {
        if (p == null) return null;
        return new AgentToolInvocationVO(
            p.getId(),
            p.getRunId(),
            p.getInvocationKey(),
            p.getToolName(),
            p.getInputFingerprint(),
            p.getStatus(),
            p.getOutputJson() == null ? null : read(p.getOutputJson(), AgentToolInvocationResultVO.class),
            p.getErrorCode(),
            p.getCreatedAt(),
            p.getCompletedAt()
        );
    }

    private String write(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.UN_ERROR);
        }
    }

    private <T> T read(String value, Class<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (JsonProcessingException error) {
            throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.UN_ERROR);
        }
    }

    private <T> T read(String value, TypeReference<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (JsonProcessingException error) {
            throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.UN_ERROR);
        }
    }
}
