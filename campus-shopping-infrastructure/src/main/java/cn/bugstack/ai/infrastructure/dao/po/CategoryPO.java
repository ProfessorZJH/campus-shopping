package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 类目持久化对象。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryPO {

  private String code;
  private String name;
  private Boolean active;
}
