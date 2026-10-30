package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IProposalRepository {
    void insert(ProposalVO proposal);
    ProposalVO proposal(String id, boolean lock);
    void proposalState(String id, String status, String selectionHash);
    List<ProposalVO> proposals(String user, String conversation);
}
