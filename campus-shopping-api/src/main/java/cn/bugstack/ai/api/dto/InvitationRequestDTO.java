package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 邀请已有账号成为店员。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationRequestDTO {

    private String username;
}
