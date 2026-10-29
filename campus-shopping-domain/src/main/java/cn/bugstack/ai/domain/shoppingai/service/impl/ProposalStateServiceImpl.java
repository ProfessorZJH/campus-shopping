package cn.bugstack.ai.domain.shoppingai.service.impl;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IProposalRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalStatusEnumVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationStateService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalStateService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static cn.bugstack.ai.types.common.Checks.require;

/**
 * 导购提案状态管理：本人查询、确认后状态落库、拒绝。
 * 确认加购的价格/库存/商户复权由 ShoppingAiCase 在同一事务中协调。
 */
@Service
public class ProposalStateServiceImpl implements IProposalStateService {
    private final IProposalRepository repository;
    private final IConversationStateService conversations;

    public ProposalStateServiceImpl(IProposalRepository repository, IConversationStateService conversations) {
        this.repository = repository;
        this.conversations = conversations;
    }

    @Override
    public ProposalVO proposal(String actor, String id, boolean lock) {
        ProposalVO proposal = repository.proposal(id, lock);
        require(proposal != null && actor.equals(proposal.userId()), ResponseCode.NOT_FOUND);
        return proposal;
    }

    @Override
    public List<ProposalVO> proposals(String actor, String conversation) {
        conversations.conversation(actor, conversation, "历史会话");
        return repository.proposals(actor, conversation);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void confirm(String id, String hash) {
        // Case 已持有该提案行锁并复核本人选择；此处只提交最终选项。
        repository.proposalState(id, ProposalStatusEnumVO.CONFIRMED.name(), hash);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void reject(String actor, String id) {
        ProposalVO proposal = proposal(actor, id, true);
        if (proposal.statusEnum() == ProposalStatusEnumVO.REJECTED) {
            return;
        }
        ProposalAggregate aggregate = new ProposalAggregate(proposal.userId(),
                proposal.expiresAt(), proposal.status(), proposal.selectionHash());
        aggregate.reject(actor);
        repository.proposalState(id, aggregate.getStatus(), null);
    }
}
