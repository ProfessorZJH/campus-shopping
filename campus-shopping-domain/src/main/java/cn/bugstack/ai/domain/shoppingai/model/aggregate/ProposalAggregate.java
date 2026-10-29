package cn.bugstack.ai.domain.shoppingai.model.aggregate;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;

import static cn.bugstack.ai.types.common.Checks.require;

/** 导购提案状态机：所有写操作都必须经过本人确认和期限校验。 */
public final class ProposalAggregate {
    private final String owner;
    private final Instant expiresAt;
    private ProposalStatusEnumVO status;
    private String selectionHash;

    public ProposalAggregate(String owner, Instant expiresAt, String status, String selectionHash) {
        this.owner = owner;
        this.expiresAt = expiresAt;
        this.status = ProposalStatusEnumVO.fromCode(status);
        this.selectionHash = selectionHash;
    }

    /** 已确认的同一选择可安全重放，不允许用同一提案替换购买内容。 */
    public boolean confirm(String actor, String choiceHash, Instant now) {
        require(owner.equals(actor), ResponseCode.AUTH_FORBIDDEN);
        if (status == ProposalStatusEnumVO.CONFIRMED) {
            require(choiceHash.equals(selectionHash), ResponseCode.REQUEST_CONFLICT);
            return false;
        }
        require(status == ProposalStatusEnumVO.PENDING, ResponseCode.STATE_CONFLICT);
        require(now.isBefore(expiresAt), ResponseCode.PROPOSAL_EXPIRED);
        status = ProposalStatusEnumVO.CONFIRMED;
        selectionHash = choiceHash;
        return true;
    }

    public void reject(String actor) {
        require(owner.equals(actor), ResponseCode.AUTH_FORBIDDEN);
        require(status == ProposalStatusEnumVO.PENDING, ResponseCode.STATE_CONFLICT);
        status = ProposalStatusEnumVO.REJECTED;
    }

    public ProposalStatusEnumVO getStatusEnum() { return status; }
    public String getStatus() { return status.name(); }
    public String getSelectionHash() { return selectionHash; }
}
