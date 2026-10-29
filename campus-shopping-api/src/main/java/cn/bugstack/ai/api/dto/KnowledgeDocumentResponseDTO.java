package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 知识管理视图，不包含服务器文件路径。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class KnowledgeDocumentResponseDTO {
    private String id;
    private String rootId;
    private String baseId;
    private String title;
    private Integer version;
    private String status;
    private String indexStatus;
    private String error;
    private String content;
    private Instant createdAt;
}
