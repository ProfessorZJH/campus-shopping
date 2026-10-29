package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.*;
import java.util.*;

/** 有归属、有效期和单次消费语义的导购提案。 */
public record ProposalVO(String id, String userId, String conversationId, String status, List<ProposalItemVO> items, String selectionHash, Instant expiresAt) {
    public ProposalVO {
        ProposalStatusEnumVO.fromCode(status);
    }

    public ProposalStatusEnumVO state() {
        return ProposalStatusEnumVO.fromCode(status);
    }
}
