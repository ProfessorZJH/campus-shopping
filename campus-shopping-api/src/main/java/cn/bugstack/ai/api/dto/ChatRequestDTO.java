package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 会话归属由服务器检查，客户端不能指定知识权限白名单。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatRequestDTO {
    private String conversationId;
    private String question;
}
