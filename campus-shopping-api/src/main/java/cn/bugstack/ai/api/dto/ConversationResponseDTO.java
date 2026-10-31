package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 本人会话列表。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationResponseDTO {

  private String id;
  private String title;
  private Instant createdAt;
}
