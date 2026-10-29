package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 店员核销令牌。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyPickupRequestDTO {

    private String token;
}
