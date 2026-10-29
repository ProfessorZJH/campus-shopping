package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 来源卡片，只返回安全标题和允许展示的片段。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CitationResponseDTO {
    private String documentId;
    private String title;
    private String snippet;
}
