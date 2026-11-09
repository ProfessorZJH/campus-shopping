package cn.bugstack.ai.cases.agent.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.cases.agent.IAgentRuntimeCase;
import cn.bugstack.ai.cases.agent.model.AgentRuntimeReceipt;
import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.cases.agent.model.RunAgentCommand;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAgentRuntimePort;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentProductCandidateVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStageVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeToolCallVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeToolResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentSkuFactVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Conditional;

/** Java 权限/事实裁决与 Python 模型决策之间的受控编排。 */
@Service
@Conditional(AgentRuntimeEnabledCondition.class)
public class AgentRuntimeCaseImpl implements IAgentRuntimeCase {

    private static final int MAX_ROUNDS = 4;

    private final AgentRunCaseImpl runs;
    private final IAgentRunRepository repository;
    private final cn.bugstack.ai.cases.agent.IAgentToolInvocationCase tools;
    private final IAgentRuntimePort runtime;
    private final Clock clock;

    public AgentRuntimeCaseImpl(
        AgentRunCaseImpl runs,
        IAgentRunRepository repository,
        cn.bugstack.ai.cases.agent.IAgentToolInvocationCase tools,
        IAgentRuntimePort runtime,
        Clock clock
    ) {
        this.runs = runs;
        this.repository = repository;
        this.tools = tools;
        this.runtime = runtime;
        this.clock = clock;
    }

    /**
     * Run 本身不包事务：start/complete/fail 和工具幂等记录由各自 Case/Repository 短操作完成，
     * Python 长调用期间不持有 MySQL 事务或行锁。
     */
    @Override
    public AgentRuntimeReceipt run(RunAgentCommand command) {
        require(command != null, ResponseCode.ILLEGAL_PARAMETER);
        AgentRunVO run = loadUsableRun(command);
        runs.start(command.actor(), run.id(), command.capabilityToken());
        AgentRuntimeResultVO result = null;
        int rounds = 0;
        try {
            String requestId = command.requestId() == null ? UUID.randomUUID().toString() : command.requestId();
            result = runtime.run(new AgentRuntimeCommandVO(
                run.id(),
                requestId,
                command.capabilityToken(),
                AgentRuntimeStageVO.START,
                command.question(),
                run.scope(),
                run.allowedTools(),
                null,
                List.of()
            ));
            for (rounds = 1; rounds <= MAX_ROUNDS; rounds++) {
                if (result.status() == AgentRuntimeStatusVO.FINAL) {
                    runs.complete(command.actor(), run.id(), command.capabilityToken());
                    return receipt(result, rounds);
                }
                if (result.status() == AgentRuntimeStatusVO.FAILED) {
                    failRun(command, result.errorCode());
                    return receipt(result, rounds);
                }
                require(result.status() == AgentRuntimeStatusVO.TOOL_CALLS, ResponseCode.AI_UNAVAILABLE);
                require(result.continuationId() != null && !result.continuationId().isBlank(), ResponseCode.AI_UNAVAILABLE);
                List<AgentRuntimeToolResultVO> toolResults = invokeTools(command, result.toolCalls());
                if (rounds == MAX_ROUNDS) {
                    failRun(command, "ROUND_TRIP_LIMIT");
                    return new AgentRuntimeReceipt(run.id(), AgentRuntimeStatusVO.FAILED, null, "DEGRADED", "ROUND_TRIP_LIMIT", rounds, result);
                }
                AgentRunVO current = loadUsableRun(command);
                result = runtime.run(new AgentRuntimeCommandVO(
                    current.id(),
                    continuationRequestId(command.requestId(), rounds),
                    command.capabilityToken(),
                    AgentRuntimeStageVO.CONTINUE,
                    null,
                    current.scope(),
                    current.allowedTools(),
                    result.continuationId(),
                    toolResults
                ));
            }
            failRun(command, "ROUND_TRIP_LIMIT");
            return new AgentRuntimeReceipt(run.id(), AgentRuntimeStatusVO.FAILED, null, "DEGRADED", "ROUND_TRIP_LIMIT", rounds, result);
        } catch (AppException error) {
            failRunQuietly(command);
            throw error;
        } catch (RuntimeException error) {
            failRunQuietly(command);
            throw new AppException(ResponseCode.AI_UNAVAILABLE, error);
        }
    }

    private AgentRunVO loadUsableRun(RunAgentCommand command) {
        AgentRunVO run = repository.find(command.runId());
        require(run != null && command.actor().equals(run.userId()), ResponseCode.NOT_FOUND);
        // 由现有 Case 复核 capability、状态和唯一 turn lease，避免本编排复制权限规则。
        return runs.usable(command.actor(), run.id(), command.capabilityToken());
    }

    private List<AgentRuntimeToolResultVO> invokeTools(RunAgentCommand command, List<AgentRuntimeToolCallVO> calls) {
        require(calls != null && !calls.isEmpty(), ResponseCode.AI_UNAVAILABLE);
        List<AgentRuntimeToolResultVO> results = new ArrayList<>(calls.size());
        for (AgentRuntimeToolCallVO call : calls) {
            Map<String, Object> arguments = call.arguments();
            String query = requiredText(arguments, "query", 2000);
            int limit = integer(arguments, "limit", 1, 20, 10);
            String merchantId = optionalText(arguments, "merchantId", 64);
            String invocationKey = "runtime-" + Fingerprints.sha256(command.runId() + "|" + call.callId()).substring(0, 60);
            AgentToolResultVO result = tools.invoke(new AgentToolInvocationCommand(
                command.actor(), command.runId(), command.capabilityToken(), invocationKey, call.name(), query, limit, merchantId
            ));
            results.add(new AgentRuntimeToolResultVO(call.callId(), call.name(), resultPayload(result), null));
        }
        return List.copyOf(results);
    }

    private Map<String, Object> resultPayload(AgentToolResultVO result) {
        List<Map<String, Object>> candidates = result.candidates().stream().map(this::candidatePayload).toList();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tool", result.tool());
        payload.put("version", result.version());
        payload.put("readOnly", result.readOnly());
        payload.put("candidates", candidates);
        return Map.copyOf(payload);
    }

    private Map<String, Object> candidatePayload(AgentProductCandidateVO candidate) {
        List<Map<String, Object>> offers = candidate.offers().stream().map(this::offerPayload).toList();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", candidate.productId());
        payload.put("merchantId", candidate.merchantId());
        payload.put("storeId", candidate.storeId());
        payload.put("title", candidate.title());
        payload.put("source", candidate.source());
        payload.put("verified", candidate.factVerified());
        payload.put("offers", offers);
        return Map.copyOf(payload);
    }

    private Map<String, Object> offerPayload(AgentSkuFactVO offer) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("skuId", offer.skuId());
        payload.put("specKey", offer.specKey());
        payload.put("priceCent", offer.priceCent());
        payload.put("priceVersion", offer.priceVersion());
        payload.put("availableQuantity", offer.availableQuantity());
        return Map.copyOf(payload);
    }

    private AgentRuntimeReceipt receipt(AgentRuntimeResultVO result, int rounds) {
        return new AgentRuntimeReceipt(
            result.runId(), result.status(), result.answer(), result.evidenceStatus(), result.errorCode(), rounds, result
        );
    }

    private void failRun(RunAgentCommand command, String errorCode) {
        try {
            runs.fail(command.actor(), command.runId(), command.capabilityToken());
        } catch (RuntimeException ignored) {
            // 原始失败优先；租约过期时不能为了记录失败重新取得权限。
        }
    }

    private void failRunQuietly(RunAgentCommand command) {
        failRun(command, "AI_UNAVAILABLE");
    }

    private String continuationRequestId(String initial, int round) {
        String prefix = initial == null ? "runtime" : initial;
        String value = prefix + "-c-" + round + "-" + UUID.randomUUID();
        return value.length() <= 128 ? value : value.substring(0, 128);
    }

    private String requiredText(Map<String, Object> arguments, String key, int max) {
        Object value = arguments.get(key);
        require(value instanceof String text && !text.isBlank() && text.length() <= max, ResponseCode.ILLEGAL_PARAMETER);
        return ((String) value).strip();
    }

    private String optionalText(Map<String, Object> arguments, String key, int max) {
        Object value = arguments.get(key);
        if (value == null) return null;
        require(value instanceof String text && !text.isBlank() && text.length() <= max, ResponseCode.ILLEGAL_PARAMETER);
        return ((String) value).strip();
    }

    private int integer(Map<String, Object> arguments, String key, int min, int max, int defaultValue) {
        Object value = arguments.get(key);
        if (value == null) return defaultValue;
        require(value instanceof Number && !(value instanceof Float) && !(value instanceof Double), ResponseCode.ILLEGAL_PARAMETER);
        Number number = (Number) value;
        int result = number.intValue();
        require(result >= min && result <= max && number.longValue() == result, ResponseCode.ILLEGAL_PARAMETER);
        return result;
    }
}
