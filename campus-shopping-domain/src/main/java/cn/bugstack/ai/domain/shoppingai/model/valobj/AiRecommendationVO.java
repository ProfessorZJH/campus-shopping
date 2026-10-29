package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.*;
import java.util.*;

/** 远程模型只提供候选 SKU，Java 不直接信任其写操作建议。 */
public record AiRecommendationVO(String skuId, int quantity, String reason) {}
