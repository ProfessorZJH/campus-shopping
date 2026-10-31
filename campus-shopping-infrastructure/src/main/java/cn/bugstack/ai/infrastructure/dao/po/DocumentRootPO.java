package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 同一文档的版本序列与当前生效指针。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentRootPO {

  private String id;
  private String baseId;
  private String activeDocumentId;
  private Integer versionCounter;
}
