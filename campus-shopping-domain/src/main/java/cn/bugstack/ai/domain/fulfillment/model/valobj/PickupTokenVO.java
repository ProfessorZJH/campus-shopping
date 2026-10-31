package cn.bugstack.ai.domain.fulfillment.model.valobj;

import java.time.*;
import java.util.*;

/** 仅签发时向本人返回自提凭证明文，服务端仅保存摘要。 */
public record PickupTokenVO(String token, Instant expiresAt) {}
