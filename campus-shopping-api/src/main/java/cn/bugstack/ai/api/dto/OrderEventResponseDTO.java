package cn.bugstack.ai.api.dto;

import java.time.Instant;
import lombok.*;

/** 订单/售后时间线事件；只投影已记录事实。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEventResponseDTO {

    private String eventId;
    private String type;
    private Instant occurredAt;
    private String actorRole;
    private String reason;
}
