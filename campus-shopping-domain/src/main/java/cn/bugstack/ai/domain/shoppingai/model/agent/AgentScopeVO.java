package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;

/** Agent 每轮由 Java 生成的最小身份、资源和租约快照。 */
public record AgentScopeVO(
    String userId,
    String identityKind,
    String identityId,
    Set<String> authorizedMerchantIds,
    Set<String> permissions,
    String conversationId,
    String turnToken,
    Instant turnExpiresAt
) {
    public static final String CONSUMER = "consumer";
    public static final String MERCHANT = "merchant";
    public static final String PRODUCT_SEARCH_PERMISSION = "catalog.product.search";

    public AgentScopeVO {
        require(userId != null && !userId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(CONSUMER.equals(identityKind) || MERCHANT.equals(identityKind), ResponseCode.ILLEGAL_PARAMETER);
        require(identityId == null || !identityId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(conversationId != null && !conversationId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(turnToken != null && !turnToken.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        Objects.requireNonNull(turnExpiresAt);
        authorizedMerchantIds = Set.copyOf(authorizedMerchantIds == null ? Set.of() : authorizedMerchantIds);
        permissions = Set.copyOf(permissions == null ? Set.of() : permissions);
    }

    public boolean expired(Clock clock) {
        return !turnExpiresAt.isAfter(clock.instant());
    }

    public boolean permitsProductSearch() {
        return permissions.contains(PRODUCT_SEARCH_PERMISSION);
    }

    public String resolveMerchant(String requestedMerchantId) {
        if (!permitsProductSearch()) throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.AUTH_FORBIDDEN);
        if (MERCHANT.equals(identityKind) && requestedMerchantId != null && !authorizedMerchantIds.contains(requestedMerchantId)) {
            throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.AUTH_FORBIDDEN);
        }
        if (!MERCHANT.equals(identityKind)) return requestedMerchantId;
        if (requestedMerchantId == null && authorizedMerchantIds.size() != 1) {
            throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), "商户范围不明确");
        }
        String resolved = requestedMerchantId == null ? authorizedMerchantIds.iterator().next() : requestedMerchantId;
        require(identityId == null || identityId.equals(resolved), ResponseCode.AUTH_FORBIDDEN);
        return resolved;
    }
}
