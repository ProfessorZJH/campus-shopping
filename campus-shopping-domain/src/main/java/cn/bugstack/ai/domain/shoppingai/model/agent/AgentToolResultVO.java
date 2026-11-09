package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;

public record AgentToolResultVO(String tool, String version, boolean readOnly, List<AgentProductCandidateVO> candidates) {
    public AgentToolResultVO {
        require("search_products".equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        require("1.0".equals(version), ResponseCode.ILLEGAL_PARAMETER);
        require(readOnly, ResponseCode.AUTH_FORBIDDEN);
        candidates = List.copyOf(candidates == null ? List.of() : candidates);
        require(candidates.size() <= 20, ResponseCode.REQUEST_TOO_LARGE);
    }
}
