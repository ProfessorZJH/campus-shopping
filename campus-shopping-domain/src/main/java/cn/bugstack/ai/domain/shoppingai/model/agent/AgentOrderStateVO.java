package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.Set;

/** Agent 订单查询允许的状态筛选值；与交易状态码保持字符串契约，避免跨域依赖交易聚合。 */
public final class AgentOrderStateVO {

    private static final Set<String> VALUES = Set.of("PENDING_PAYMENT", "PAID", "COMPLETED", "CANCELED", "REFUNDED");

    private AgentOrderStateVO() {}

    public static String filter(String value) {
        if (value == null || value.isBlank()) return "";
        String normalized = value.strip();
        require(VALUES.contains(normalized), ResponseCode.ILLEGAL_PARAMETER);
        return normalized;
    }
}
