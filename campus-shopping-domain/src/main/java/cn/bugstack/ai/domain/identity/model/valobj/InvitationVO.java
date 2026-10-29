package cn.bugstack.ai.domain.identity.model.valobj;
import java.util.*;
import java.time.*;
/** 邀请只允许目标用户在有效期内接受。 */
public record InvitationVO(String id, String merchantId, String targetUserId, String status, Instant expiresAt) {}
