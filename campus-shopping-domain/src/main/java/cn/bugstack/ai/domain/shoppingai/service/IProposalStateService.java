package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

/** 导购提案：本人归属、确认和拒绝；加购需由 Case 重新核价核库存。 */
public interface IProposalStateService {
    ProposalVO proposal(String actor, String id, boolean lock);
    List<ProposalVO> proposals(String actor, String conversation);
    void confirm(String id, String selectionHash);
    void reject(String actor, String id);
}
