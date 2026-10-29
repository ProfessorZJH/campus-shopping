package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 同一文档的版本序列与当前生效指针。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentRootPO {
    private String id;
    private String baseId;
    private String activeDocumentId;
    private Integer versionCounter;
}
