package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 可管理知识库。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class KnowledgeBaseResponseDTO {
    private String id;
    private String name;
    private String merchantId;
    private String visibility;
}
