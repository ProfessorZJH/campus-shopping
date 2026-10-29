package cn.bugstack.ai.domain.shoppingai.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IProposalRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Proposal 领域能力；仓储仅维护对应业务事实。 */
@Service
public class ProposalServiceImpl implements IProposalService {

    private final IProposalRepository repository;
    private final Clock clock;
    private final IConversationService conversations;

    public ProposalServiceImpl(IProposalRepository repository, Clock clock, IConversationService conversations) {
        this.repository = repository;
        this.clock = clock;
        this.conversations = conversations;
    }

    public ProposalVO proposal(String actor, String id) {
        return required(actor, id, false);
    }

    private ProposalVO required(String actor, String id, boolean lock) {
        ProposalVO p = repository.proposal(id, lock);
        require(p != null && actor.equals(p.userId()), ResponseCode.NOT_FOUND);
        return p;
    }

    public List<ProposalVO> proposals(String actor, String conversation) {
        conversations.conversation(actor, conversation, "历史会话");
        return repository.proposals(actor, conversation);
    }

    /** 返回 null 表示相同选择已确认；调用方只在首次确认时执行同事务加购。 */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ProposalVO confirmSelection(String actor, String id, List<String> selected) {
        require(
            selected != null && !selected.isEmpty() && selected.size() <= 20 && selected.stream().allMatch(s -> s != null && !s.isBlank() && s.length() <= 64),
            ResponseCode.ILLEGAL_PARAMETER
        );
        var ids = selected.stream().distinct().sorted().toList();
        require(ids.size() == selected.size(), ResponseCode.ILLEGAL_PARAMETER);
        ProposalVO p = required(actor, id, true);
        var proposed = p.items().stream().map(ProposalItemVO::skuId).collect(java.util.stream.Collectors.toSet());
        require(proposed.containsAll(ids), ResponseCode.ILLEGAL_PARAMETER);
        var aggregate = new ProposalAggregate(p.userId(), p.expiresAt(), p.status(), p.selectionHash());
        if (!aggregate.confirm(actor, Fingerprints.of(ids.toArray()), clock.instant())) return null;
        repository.proposalState(id, aggregate.getStatus(), aggregate.getSelectionHash());
        return p;
    }

    @Transactional(rollbackFor = Exception.class)
    public void reject(String actor, String id) {
        ProposalVO p = required(actor, id, true);
        if ("REJECTED".equals(p.status())) return;
        ProposalAggregate aggregate = new ProposalAggregate(p.userId(), p.expiresAt(), p.status(), p.selectionHash());
        aggregate.reject(actor);
        repository.proposalState(id, aggregate.getStatus(), null);
    }
}
