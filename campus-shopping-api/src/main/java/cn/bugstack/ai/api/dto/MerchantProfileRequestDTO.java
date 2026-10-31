package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 商户经营资料；只有本商户 Owner 可修改。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerchantProfileRequestDTO {

  private String name;
  private String storeName;
  private String location;
}
