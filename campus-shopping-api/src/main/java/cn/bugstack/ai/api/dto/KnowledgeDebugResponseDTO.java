package cn.bugstack.ai.api.dto;

import java.util.*;
import lombok.*;

/** RAG 调试结果，回答预览与检索模式明确区分。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeDebugResponseDTO {
    private String query;
    private String retrievalMode;
    private String answerMode;
    private String answerPreview;
    private String warning;
    private List<KnowledgeDebugHitResponseDTO> hits;
    private Long latencyMs;
}
