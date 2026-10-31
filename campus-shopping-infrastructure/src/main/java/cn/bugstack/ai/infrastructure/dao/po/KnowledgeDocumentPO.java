package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 知识版本持久化投影。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeDocumentPO {

  private String id;
  private String rootId;
  private String baseId;
  private String title;
  private String merchantId;
  private String visibility;
  private Integer version;
  private String status;
  private String indexStatus;
  private String content;
  private String error;
  private Instant createdAt;
}
