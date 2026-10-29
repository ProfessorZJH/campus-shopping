package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

/** 提案快照与选择哈希的持久化抽象，所有确认操作由 Case 校验后提交。 */
public interface IProposalRepository {
    void insertProposal(ProposalVO proposal);
    ProposalVO proposal(String id, boolean lock);
    void proposalState(String id, String status, String selectionHash);
    List<ProposalVO> proposals(String user, String conversation);
}
