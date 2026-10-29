package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 仅可选择服务器提案中的 SKU；请求本身表示用户确认。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ConfirmProposalRequestDTO {
    private List<String> selectedSkuIds;
}
