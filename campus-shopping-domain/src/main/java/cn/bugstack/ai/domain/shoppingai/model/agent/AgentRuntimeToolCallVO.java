package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.Map;

public record AgentRuntimeToolCallVO(String callId, String name, Map<String, Object> arguments) {
    public AgentRuntimeToolCallVO {
        require(callId != null && !callId.isBlank() && callId.length() <= 128, ResponseCode.ILLEGAL_PARAMETER);
        require(AgentToolRegistry.contains(name), ResponseCode.AUTH_FORBIDDEN);
        arguments = Map.copyOf(arguments == null ? Map.of() : arguments);
    }
}
