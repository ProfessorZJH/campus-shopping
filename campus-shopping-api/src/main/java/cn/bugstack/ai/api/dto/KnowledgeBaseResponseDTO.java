package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 可管理知识库。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseResponseDTO {

    private String id;
    private String name;
    private String merchantId;
    private String visibility;
}
