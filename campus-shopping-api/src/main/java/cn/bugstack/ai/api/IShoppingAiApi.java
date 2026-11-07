package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 ShoppingAiController 实现。 */
public interface IShoppingAiApi {
    /** 授权检索和导购建议；此接口不执行购物车写入。 */
    Response<ChatResponseDTO> chat(ChatRequestDTO request, Principal principal);
    /** 只读 RAG 命中调试；服务端复用正式授权范围并重新核验版本。 */
    Response<KnowledgeDebugResponseDTO> debugRetrieval(KnowledgeDebugRequestDTO request, Principal principal);
    /** 本人会话列表。 */
    Response<List<ConversationResponseDTO>> conversations(int page, int size, Principal principal);
    /** 加载已重新核验知识权限的历史回答。 */
    Response<List<MessageResponseDTO>> history(String conversationId, Principal principal);
    /** 查询本人当前会话轮次状态，不返回内部租约令牌。 */
    Response<ConversationTurnStatusResponseDTO> turnStatus(String conversationId, Principal principal);
    /** 请求停止当前轮次；下游实际结束前状态保持取消处理中。 */
    Response<ConversationTurnStatusResponseDTO> cancelTurn(String conversationId, Principal principal);
    /** 本人会话产生的提案。 */
    Response<List<ProposalResponseDTO>> proposals(String conversationId, Principal principal);
    /** 明确确认后，复核价格版本并单次加购。 */
    Response<ProposalResponseDTO> confirm(String proposalId, ConfirmProposalRequestDTO request, Principal principal);
    /** 拒绝提案，不修改购物车。 */
    Response<Void> reject(String proposalId, Principal principal);
}
