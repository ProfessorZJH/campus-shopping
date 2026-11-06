package cn.bugstack.ai.api.dto;

import lombok.*;

/** 已经完成授权和版本复核的检索命中。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeDebugHitResponseDTO {
    private String documentId;
    private String title;
    private String rootId;
    private Integer version;
    private String snippet;
    private Integer rank;
    private Double score;
    private String scoreType;
}
