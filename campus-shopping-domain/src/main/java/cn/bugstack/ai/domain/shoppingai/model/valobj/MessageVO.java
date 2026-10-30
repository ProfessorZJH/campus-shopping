package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.Instant;

/** 回答保存生成时的可访问资料指纹；权限/版本变化后历史回答需遮蔽。 */
public record MessageVO(String id, String conversationId, String role, String content, Instant createdAt, String accessFingerprint) {
    public MessageVO {
        MessageRoleEnumVO.fromCode(role);
    }

    public MessageRoleEnumVO state() {
        return MessageRoleEnumVO.fromCode(role);
    }
}
