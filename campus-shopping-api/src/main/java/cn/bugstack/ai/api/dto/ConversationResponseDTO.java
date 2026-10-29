package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 本人会话列表。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ConversationResponseDTO {
    private String id;
    private String title;
    private Instant createdAt;
}
