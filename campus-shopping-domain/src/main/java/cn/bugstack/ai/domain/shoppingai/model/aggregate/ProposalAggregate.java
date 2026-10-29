package cn.bugstack.ai.domain.shoppingai.model.aggregate;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import static cn.bugstack.ai.types.common.Checks.require;
/** 建议确认幂等状态；已确认结果可重放，但不能更换选择再次加购。 */
public final class ProposalAggregate {
    private final String owner; private final Instant expiresAt;
    private String status, selectionHash;
    public ProposalAggregate(String owner,Instant expiresAt,String status,String selectionHash){this.owner=owner;this.expiresAt=expiresAt;this.status=status;this.selectionHash=selectionHash;}
    public boolean confirm(String actor,String choiceHash,Instant now){
        require(owner.equals(actor),ResponseCode.AUTH_FORBIDDEN);
        if("CONFIRMED".equals(status)){require(choiceHash.equals(selectionHash),ResponseCode.REQUEST_CONFLICT);return false;}
        require("PENDING".equals(status),ResponseCode.STATE_CONFLICT);
        require(now.isBefore(expiresAt),ResponseCode.PROPOSAL_EXPIRED);
        status="CONFIRMED";selectionHash=choiceHash;return true;
    }
    public void reject(String actor){require(owner.equals(actor),ResponseCode.AUTH_FORBIDDEN);require("PENDING".equals(status),ResponseCode.STATE_CONFLICT);status="REJECTED";}
    public String getStatus(){return status;} public String getSelectionHash(){return selectionHash;}
}
