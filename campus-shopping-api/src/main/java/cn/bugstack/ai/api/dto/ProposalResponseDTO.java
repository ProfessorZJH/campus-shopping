package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 用户自己的导购提案。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProposalResponseDTO {
    private String id;
    private String status;
    private List<ProposalItemResponseDTO> items;
    private Instant expiresAt;
}
