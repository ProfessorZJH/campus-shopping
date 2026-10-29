package cn.bugstack.ai.domain.shoppingai.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalStatusEnumVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** 建议确认幂等状态；已确认结果可重放，但不能更换选择再次加购。 */
public final class ProposalAggregate {

    private final String owner;
    private final Instant expiresAt;
    private ProposalStatusEnumVO status;
    private String selectionHash;

    public ProposalAggregate(String owner, Instant expiresAt, String status, String selectionHash) {
        this.owner = Objects.requireNonNull(owner);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.status = ProposalStatusEnumVO.fromCode(status);
        this.selectionHash = selectionHash;
    }

    /** 创建身份、归属和冻结商品快照统一在领域入口建立。 */
    public static ProposalVO create(String owner, String conversation, List<ProposalItemVO> items, Instant expiresAt, Instant now) {
        require(owner != null && !owner.isBlank() && conversation != null && !conversation.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(expiresAt != null && expiresAt.isAfter(now) && !expiresAt.isAfter(now.plusSeconds(1800)), ResponseCode.ILLEGAL_PARAMETER);
        require(items != null && !items.isEmpty() && items.size() <= 3, ResponseCode.ILLEGAL_PARAMETER);
        var ids = new HashSet<String>();
        for (var item : items) {
            require(
                item != null &&
                    item.skuId() != null &&
                    !item.skuId().isBlank() &&
                    ids.add(item.skuId()) &&
                    item.merchantId() != null &&
                    !item.merchantId().isBlank() &&
                    item.priceCent() > 0 &&
                    item.quoteVersion() >= 0 &&
                    item.quantity() >= 1 &&
                    item.quantity() <= 99,
                ResponseCode.ILLEGAL_PARAMETER
            );
        }
        return new ProposalVO(UUID.randomUUID().toString(), owner, conversation, ProposalStatusEnumVO.PENDING.getCode(), List.copyOf(items), null, expiresAt);
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
