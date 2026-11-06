package cn.bugstack.ai.api.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsStatusDTO { private String status; private Long orderCount; private Long amountCent; }
