package cn.bugstack.ai.cases.shoppingai;

import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

/** 导购问答只产生提案，明确确认后才允许调用购物车写能力。 */
public interface IShoppingAiCase {
    ChatResult chat(String actor, String conversation, String question);
    List<MessageVO> history(String actor, String conversation);
    List<ConversationVO> conversations(String actor, int page, int size);
    List<ProposalVO> proposals(String actor, String conversation);
    ProposalVO confirm(String actor, String proposal, List<String> selectedSkus);
    void reject(String actor, String proposal);
}
