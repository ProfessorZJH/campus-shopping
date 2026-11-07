package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;
import java.util.List;

/** 回答保存生成时的可访问资料指纹；权限/版本变化后历史回答需遮蔽。 */
public record MessageVO(
    String id,
    String conversationId,
    String role,
    String content,
    Instant createdAt,
    String accessFingerprint,
    List<AiCitationVO> citations,
    boolean citationsRecorded,
    boolean citationsVisible
) {
    public MessageVO(String id, String conversationId, String role, String content, Instant createdAt, String accessFingerprint) {
        this(id, conversationId, role, content, createdAt, accessFingerprint, List.of(), false, true);
    }

    public MessageVO(
        String id,
        String conversationId,
        String role,
        String content,
        Instant createdAt,
        String accessFingerprint,
        List<AiCitationVO> citations,
        boolean citationsRecorded
    ) {
        this(id, conversationId, role, content, createdAt, accessFingerprint, citations, citationsRecorded, true);
    }

    public MessageVO {
        MessageRoleEnumVO.fromCode(role);
        citations = citations == null ? List.of() : List.copyOf(citations);
    }

    public MessageRoleEnumVO state() {
        return MessageRoleEnumVO.fromCode(role);
    }
}
