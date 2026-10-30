package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 ShoppingAiController 实现。 */
public interface IShoppingAiApi {
    /** 授权检索和导购建议；此接口不执行购物车写入。 */
    Response<ChatResponseDTO> chat(ChatRequestDTO request, Principal principal);
    /** 本人会话列表。 */
    Response<List<ConversationResponseDTO>> conversations(Principal principal);
    /** 加载已重新核验知识权限的历史回答。 */
    Response<List<MessageResponseDTO>> history(String conversationId, Principal principal);
    /** 本人会话产生的提案。 */
    Response<List<ProposalResponseDTO>> proposals(String conversationId, Principal principal);
    /** 明确确认后，复核价格版本并单次加购。 */
    Response<ProposalResponseDTO> confirm(String proposalId, ConfirmProposalRequestDTO request, Principal principal);
    /** 拒绝提案，不修改购物车。 */
    Response<Void> reject(String proposalId, Principal principal);
}
