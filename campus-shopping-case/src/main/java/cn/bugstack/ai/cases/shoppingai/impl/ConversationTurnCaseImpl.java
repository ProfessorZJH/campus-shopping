package cn.bugstack.ai.cases.shoppingai.impl;

import cn.bugstack.ai.cases.shoppingai.IConversationTurnCase;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 只包裹会话消息与提案的原子落库，不执行远程模型调用。 */
@Service
public class ConversationTurnCaseImpl implements IConversationTurnCase {

    private final IConversationService conversations;
    private final IProposalService proposals;

    public ConversationTurnCaseImpl(IConversationService conversations, IProposalService proposals) {
        this.conversations = conversations;
        this.proposals = proposals;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProposalVO complete(ConversationTurnVO turn, String question, String answer, List<ProposalItemVO> items, Instant expiresAt, String fingerprint) {
        return complete(turn, question, answer, items, List.of(), expiresAt, fingerprint);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProposalVO complete(
        ConversationTurnVO turn,
        String question,
        String answer,
        List<ProposalItemVO> items,
        List<AiCitationVO> citations,
        Instant expiresAt,
        String fingerprint
    ) {
        conversations.appendTurn(turn, question, answer, citations, fingerprint);
        return items.isEmpty() ? null : proposals.create(turn.userId(), turn.conversationId(), items, expiresAt);
    }
}
