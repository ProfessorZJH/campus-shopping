package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 创建知识库，平台库必须由平台管理员创建。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseRequestDTO {

  private String merchantId;
  private String name;
  private String visibility;
}
