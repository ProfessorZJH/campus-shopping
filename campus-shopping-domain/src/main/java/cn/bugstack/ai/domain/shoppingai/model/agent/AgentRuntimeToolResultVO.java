package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record AgentRuntimeToolResultVO(String callId, String name, Map<String, Object> result, String errorCode) {
    public AgentRuntimeToolResultVO {
        require(callId != null && !callId.isBlank() && callId.length() <= 128, ResponseCode.ILLEGAL_PARAMETER);
        require(AgentToolRegistry.contains(name), ResponseCode.AUTH_FORBIDDEN);
        result = Collections.unmodifiableMap(new LinkedHashMap<>(result == null ? Map.of() : result));
    }
}
