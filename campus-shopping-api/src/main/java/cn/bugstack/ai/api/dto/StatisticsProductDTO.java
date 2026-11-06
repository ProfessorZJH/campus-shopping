package cn.bugstack.ai.api.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsProductDTO { private String skuId; private String title; private Long quantity; }
