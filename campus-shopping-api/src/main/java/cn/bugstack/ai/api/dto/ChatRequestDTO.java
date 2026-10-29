package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 会话归属由服务器检查，客户端不能指定知识权限白名单。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequestDTO {

    private String conversationId;
    private String question;
}
