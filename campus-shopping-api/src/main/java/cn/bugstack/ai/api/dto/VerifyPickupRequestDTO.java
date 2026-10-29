package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 店员核销令牌。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VerifyPickupRequestDTO {
    private String token;
}
