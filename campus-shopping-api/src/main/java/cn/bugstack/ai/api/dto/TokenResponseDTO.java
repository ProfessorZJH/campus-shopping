package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 本人新签发的自提令牌；不持久化到浏览器本地存储。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponseDTO {

  private String token;
  private Instant expiresAt;
}
