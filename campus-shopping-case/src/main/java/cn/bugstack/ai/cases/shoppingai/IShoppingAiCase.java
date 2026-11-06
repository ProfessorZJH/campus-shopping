package cn.bugstack.ai.cases.shoppingai;

import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.cases.shoppingai.model.ProposalView;
import cn.bugstack.ai.cases.shoppingai.model.KnowledgeDebugResult;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.LongConsumer;

/** 导购问答只产生提案，明确确认后才允许调用购物车写能力。 */
public interface IShoppingAiCase {
    ChatResult chat(String actor, String conversation, String question);
    KnowledgeDebugResult debugRetrieval(String actor, String question, boolean answerPreview);
    ChatResult chatStream(String actor, String conversation, String question, Consumer<String> conversationReady, LongConsumer progress);
    List<MessageVO> history(String actor, String conversation);
    List<ConversationVO> conversations(String actor, int page, int size);
    ConversationTurnStatusVO turnStatus(String actor, String conversation);
    ConversationTurnStatusVO requestTurnCancel(String actor, String conversation);
    List<ProposalVO> proposals(String actor, String conversation);
    List<ProposalView> proposalViews(String actor, String conversation);
    ProposalVO confirm(String actor, String proposal, List<String> selectedSkus);
    void reject(String actor, String proposal);
}
