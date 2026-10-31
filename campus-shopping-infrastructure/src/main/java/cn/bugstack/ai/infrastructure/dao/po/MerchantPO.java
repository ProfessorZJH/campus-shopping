package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 商户与门店查询投影，映射由仓储完成。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerchantPO {

  private String id;
  private String applicationId;
  private String name;
  private String category;
  private String status;
  private String storeId;
  private String storeName;
  private String location;
}
