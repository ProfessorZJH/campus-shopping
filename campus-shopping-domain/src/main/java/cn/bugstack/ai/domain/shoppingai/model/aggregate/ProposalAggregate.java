package cn.bugstack.ai.domain.shoppingai.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalStatusEnumVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;

/** 建议确认幂等状态；已确认结果可重放，但不能更换选择再次加购。 */
public final class ProposalAggregate {

    private final ProposalVO original;
    private final String owner;
    private final Instant expiresAt;
    private ProposalStatusEnumVO status;
    private String selectionHash;

    /** 从完整提案快照恢复领域身份和冻结的商品选择范围。 */
    public ProposalAggregate(ProposalVO proposal) {
        this.original = Objects.requireNonNull(proposal);
        this.owner = Objects.requireNonNull(proposal.userId());
        this.expiresAt = Objects.requireNonNull(proposal.expiresAt());
        this.status = proposal.state();
        this.selectionHash = proposal.selectionHash();
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

    public boolean confirm(String actor, List<String> ids, Instant now) {
        require(owner.equals(actor), ResponseCode.AUTH_FORBIDDEN);
        require(ids != null && !ids.isEmpty() && ids.size() <= original.items().size(), ResponseCode.ILLEGAL_PARAMETER);
        Set<String> allowed = original.items().stream().map(ProposalItemVO::skuId).collect(Collectors.toSet());
        require(allowed.containsAll(ids) && new HashSet<>(ids).size() == ids.size(), ResponseCode.ILLEGAL_PARAMETER);
        String choiceHash = Fingerprints.of(ids.toArray());
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
