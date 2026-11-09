package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;

/** 消费者本人订单工具请求；没有 buyer、merchant 或后台筛选字段。 */
public record AgentMyOrdersRequestVO(String tool, String version, String state, int page, int size) {
    public static final String TOOL = "get_my_orders";
    public static final String VERSION = "1.0";
    public static final int MAX_PAGE_SIZE = 20;

    public AgentMyOrdersRequestVO(String state, int page, int size) {
        this(TOOL, VERSION, state, page, size);
    }

    public AgentMyOrdersRequestVO {
        require(TOOL.equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        require(VERSION.equals(version), ResponseCode.ILLEGAL_PARAMETER);
        state = AgentOrderStateVO.filter(state);
        require(page >= 1 && page <= 10_000, ResponseCode.ILLEGAL_PARAMETER);
        require(size >= 1 && size <= MAX_PAGE_SIZE, ResponseCode.ILLEGAL_PARAMETER);
    }
}
