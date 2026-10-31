package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 商品创建或编辑请求；不接收客户端商品归属。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductRequestDTO {

  private String title;
  private String description;
  private String categoryCode;
  private String imageUrl;
  private List<SkuRequestDTO> skus;
  private Long expectedVersion;
}
