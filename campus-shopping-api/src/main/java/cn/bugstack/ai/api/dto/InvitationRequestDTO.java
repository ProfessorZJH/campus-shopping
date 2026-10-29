package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 邀请已有账号成为店员。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InvitationRequestDTO {
    private String username;
}
