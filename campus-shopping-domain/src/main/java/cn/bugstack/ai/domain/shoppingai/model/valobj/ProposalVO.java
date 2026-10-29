package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;
import java.util.List;

/** 导购提案的只读快照，状态合法性在重建时即校验。 */
public record ProposalVO(String id, String userId, String conversationId, String status,
                         List<ProposalItemVO> items, String selectionHash, Instant expiresAt) {
    public ProposalVO {
        ProposalStatusEnumVO.fromCode(status);
    }

    public ProposalStatusEnumVO statusEnum() {
        return ProposalStatusEnumVO.fromCode(status);
    }
}
