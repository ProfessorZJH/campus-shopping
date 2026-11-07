package cn.bugstack.ai.cases.shoppingai.model;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** 提案历史读模型；商品详情身份和当前可用性不改写历史报价快照。 */
public record ProposalView(String id, String status, List<ProposalItemView> items, Instant expiresAt) {
    public ProposalView {
        items = List.copyOf(Objects.requireNonNull(items));
    }

    public record ProposalItemView(ProposalItemVO snapshot, String productId, boolean detailAvailable, String detailUnavailableReason) {
        public ProposalItemView {
            Objects.requireNonNull(snapshot);
            if (detailAvailable && (productId == null || productId.isBlank())) throw new IllegalArgumentException("可用详情必须有商品身份");
            if (detailAvailable && detailUnavailableReason != null) throw new IllegalArgumentException("可用详情不能带失效原因");
            if (!detailAvailable && (detailUnavailableReason == null || detailUnavailableReason.isBlank())) throw new IllegalArgumentException(
                "不可用详情必须有原因"
            );
        }
    }
}
