package cn.bugstack.ai.domain.shoppingai.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;

/** 建议确认幂等状态；已确认结果可重放，但不能更换选择再次加购。 */
public final class ProposalAggregate {

  private final String owner;
  private final Instant expiresAt;
  private ProposalStatusEnumVO status;
  private String selectionHash;

  public ProposalAggregate(String owner, Instant expiresAt, String status, String selectionHash) {
    this.owner = java.util.Objects.requireNonNull(owner);
    this.expiresAt = java.util.Objects.requireNonNull(expiresAt);
    this.status = ProposalStatusEnumVO.fromCode(status);
    this.selectionHash = selectionHash;
  }

  public boolean confirm(String actor, String choiceHash, Instant now) {
    require(owner.equals(actor), ResponseCode.AUTH_FORBIDDEN);
    require(choiceHash != null && !choiceHash.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
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
    if (status == ProposalStatusEnumVO.REJECTED) return;
    require(status == ProposalStatusEnumVO.PENDING, ResponseCode.STATE_CONFLICT);
    status = ProposalStatusEnumVO.REJECTED;
  }

  public String getStatus() {
    return status.getCode();
  }

  public ProposalStatusEnumVO state() {
    return status;
  }

  public String getSelectionHash() {
    return selectionHash;
  }
}
