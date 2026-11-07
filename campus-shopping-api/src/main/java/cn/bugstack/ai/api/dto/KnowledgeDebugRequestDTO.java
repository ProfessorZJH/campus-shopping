package cn.bugstack.ai.api.dto;

import lombok.*;

/** 只读 RAG 调试请求；知识范围始终由服务端授权计算。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeDebugRequestDTO {

    private String question;
    private Boolean answerPreview;
}
