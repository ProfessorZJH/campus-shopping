package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 历史回答会在知识授权范围变化后被遮蔽。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponseDTO {

  private String id;
  private String role;
  private String content;
  private Instant createdAt;
}
