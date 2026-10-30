package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 仅可选择服务器提案中的 SKU；请求本身表示用户确认。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfirmProposalRequestDTO {

    private List<String> selectedSkuIds;
}
