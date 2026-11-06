package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 会话轮次的跨实例运行状态；取消请求不代表下游已停止。 */
public enum ConversationTurnStatusEnumVO {
    IDLE,
    RUNNING,
    CANCEL_REQUESTED
}
