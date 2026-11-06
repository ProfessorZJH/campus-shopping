package cn.bugstack.ai.cases.shoppingai;

/** 当前会话轮次已收到取消请求，禁止继续提交模型结果。 */
public final class AiTurnCancelledException extends RuntimeException {
    public AiTurnCancelledException() {
        super("AI turn cancelled");
    }
}
