package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 知识库范围元数据。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBasePO {

  private String id;
  private String name;
  private String merchantId;
  private String visibility;
}
