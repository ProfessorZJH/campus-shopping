package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Agent tool invocation 的只读结果 envelope。
 *
 * <p>旧版 search_products 结果仍保留 typed candidates 字段，新工具使用 payload 保存
 * 已经由 Java Case 裁决过的窄投影。payload 允许显式 null，以便 warning 等可选字段在
 * Runtime 回执中保持稳定的协议形状。</p>
 */
public record AgentToolInvocationResultVO(
    String tool,
    String version,
    boolean readOnly,
    Map<String, Object> payload,
    List<AgentProductCandidateVO> candidates
) {

    public AgentToolInvocationResultVO {
        require(AgentToolRegistry.contains(tool), ResponseCode.ILLEGAL_PARAMETER);
        require(AgentToolRegistry.VERSION.equals(version), ResponseCode.ILLEGAL_PARAMETER);
        require(readOnly, ResponseCode.AUTH_FORBIDDEN);
        payload = immutableMap(payload);
        candidates = List.copyOf(candidates == null ? List.of() : candidates);
        require(candidates.size() <= 20, ResponseCode.REQUEST_TOO_LARGE);
    }

    public AgentToolInvocationResultVO(AgentToolResultVO result) {
        this(
            result.tool(),
            result.version(),
            result.readOnly(),
            Map.of(),
            result.candidates()
        );
    }

    public AgentToolInvocationResultVO(String tool, String version, boolean readOnly, Map<String, Object> payload) {
        this(tool, version, readOnly, payload, List.of());
    }

    public static AgentToolInvocationResultVO search(AgentToolResultVO result) {
        return new AgentToolInvocationResultVO(result);
    }

    public static AgentToolInvocationResultVO knowledge(AgentKnowledgeQaResultVO result) {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("query", result.query());
        payload.put("answer", result.answer());
        payload.put("answerMode", result.answerMode());
        payload.put("retrievalMode", result.retrievalMode());
        payload.put("warning", result.warning());
        payload.put("citations", result.citations().stream().map(citation -> {
            LinkedHashMap<String, Object> value = new LinkedHashMap<>();
            value.put("documentId", citation.documentId());
            value.put("title", citation.title());
            value.put("snippet", citation.snippet());
            value.put("score", citation.score());
            return immutableMap(value);
        }).toList());
        payload.put("durationMs", result.durationMs());
        return new AgentToolInvocationResultVO(result.tool(), result.version(), result.readOnly(), payload);
    }

    public static AgentToolInvocationResultVO orders(AgentMyOrdersResultVO result) {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("state", result.state());
        payload.put("page", result.page());
        payload.put("size", result.size());
        payload.put("total", result.total());
        payload.put("items", result.items().stream().map(order -> {
            LinkedHashMap<String, Object> value = new LinkedHashMap<>();
            value.put("orderId", order.orderId());
            value.put("status", order.status());
            value.put("totalCent", order.totalCent());
            value.put("createdAt", order.createdAt().toString());
            value.put("merchantName", order.merchantName());
            value.put("items", order.items().stream().map(item -> {
                LinkedHashMap<String, Object> itemValue = new LinkedHashMap<>();
                itemValue.put("skuId", item.skuId());
                itemValue.put("title", item.title());
                itemValue.put("specKey", item.specKey());
                itemValue.put("unitPriceCent", item.unitPriceCent());
                itemValue.put("quantity", item.quantity());
                return immutableMap(itemValue);
            }).toList());
            return immutableMap(value);
        }).toList());
        return new AgentToolInvocationResultVO(result.tool(), result.version(), result.readOnly(), payload);
    }

    /**
     * Returns the payload sent back to Python Runtime. The old search result is
     * projected from its typed candidates when replaying records written before
     * the envelope was introduced.
     */
    public Map<String, Object> runtimePayload() {
        LinkedHashMap<String, Object> value = new LinkedHashMap<>();
        value.put("tool", tool);
        value.put("version", version);
        value.put("readOnly", readOnly);
        if (!payload.isEmpty()) {
            value.putAll(payload);
        } else if (AgentToolRegistry.SEARCH_PRODUCTS.equals(tool)) {
            value.put("candidates", candidates.stream().map(AgentToolInvocationResultVO::candidatePayload).toList());
        }
        return immutableMap(value);
    }

    public AgentToolResultVO asSearchResult() {
        require(AgentToolRegistry.SEARCH_PRODUCTS.equals(tool), ResponseCode.ILLEGAL_PARAMETER);
        return new AgentToolResultVO(tool, version, readOnly, candidates);
    }

    private static Map<String, Object> candidatePayload(AgentProductCandidateVO candidate) {
        LinkedHashMap<String, Object> value = new LinkedHashMap<>();
        value.put("productId", candidate.productId());
        value.put("merchantId", candidate.merchantId());
        value.put("storeId", candidate.storeId());
        value.put("title", candidate.title());
        value.put("source", candidate.source());
        value.put("verified", candidate.factVerified());
        value.put("offers", candidate.offers().stream().map(AgentToolInvocationResultVO::offerPayload).toList());
        return immutableMap(value);
    }

    private static Map<String, Object> offerPayload(AgentSkuFactVO offer) {
        LinkedHashMap<String, Object> value = new LinkedHashMap<>();
        value.put("skuId", offer.skuId());
        value.put("specKey", offer.specKey());
        value.put("priceCent", offer.priceCent());
        value.put("priceVersion", offer.priceVersion());
        value.put("availableQuantity", offer.availableQuantity());
        return immutableMap(value);
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        if (source == null || source.isEmpty()) return Map.of();
        LinkedHashMap<String, Object> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(key, immutableValue(value)));
        return Collections.unmodifiableMap(copy);
    }

    @SuppressWarnings("unchecked")
    private static Object immutableValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            LinkedHashMap<String, Object> copy = new LinkedHashMap<>();
            map.forEach((key, nested) -> copy.put(String.valueOf(key), immutableValue(nested)));
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            list.forEach(item -> copy.add(immutableValue(item)));
            return List.copyOf(copy);
        }
        return value;
    }
}
