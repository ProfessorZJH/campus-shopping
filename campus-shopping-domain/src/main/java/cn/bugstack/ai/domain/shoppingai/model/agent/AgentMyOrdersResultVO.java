package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;

/** 消费者本人订单的有界只读页。 */
public record AgentMyOrdersResultVO(
    String tool,
    String version,
    boolean readOnly,
    String state,
    int page,
    int size,
    long total,
    List<AgentOrderSummaryVO> items
) {
    public AgentMyOrdersResultVO {
        require(AgentMyOrdersRequestVO.TOOL.equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        require(AgentMyOrdersRequestVO.VERSION.equals(version), ResponseCode.ILLEGAL_PARAMETER);
        require(readOnly, ResponseCode.AUTH_FORBIDDEN);
        state = AgentOrderStateVO.filter(state);
        require(page >= 1 && page <= 10_000, ResponseCode.ILLEGAL_PARAMETER);
        require(size >= 1 && size <= AgentMyOrdersRequestVO.MAX_PAGE_SIZE, ResponseCode.ILLEGAL_PARAMETER);
        require(total >= 0, ResponseCode.ILLEGAL_PARAMETER);
        items = List.copyOf(items == null ? List.of() : items);
        require(items.size() <= size, ResponseCode.REQUEST_TOO_LARGE);
    }
}
