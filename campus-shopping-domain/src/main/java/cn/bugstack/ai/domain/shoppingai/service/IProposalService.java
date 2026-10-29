package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.time.Instant;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IProposalService {
    ProposalVO create(String actor, String conversation, List<ProposalItemVO> items, Instant expiresAt);
    ProposalVO proposal(String actor, String id);
    List<ProposalVO> proposals(String actor, String conversation);
    ProposalVO confirmSelection(String actor, String id, List<String> selected);
    void reject(String actor, String id);
}
