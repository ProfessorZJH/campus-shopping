package cn.bugstack.ai.api.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsTrendDTO { private String day; private Long orderCount; }
