package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 知识库范围元数据。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class KnowledgeBasePO {
    private String id;
    private String name;
    private String merchantId;
    private String visibility;
}
