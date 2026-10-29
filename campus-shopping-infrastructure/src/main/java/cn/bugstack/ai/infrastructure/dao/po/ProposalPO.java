package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 提案及冻结商品快照。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProposalPO {

    private String id;
    private String userId;
    private String conversationId;
    private String status;
    private String itemsJson;
    private String selectionHash;
    private Instant expiresAt;
}
