package cn.bugstack.ai.infrastructure.gateway.dto;

import java.util.List;

/** Java 与 Python 的明确 JSON 协议，不包含凭证或数据库连接信息。 */
public final class AiGatewayDTO {

    private AiGatewayDTO() {}

    public record Offer(String skuId, String merchantId, String title, String specKey, String description, long priceCent, long available) {}

    public record History(String role, String content) {}

    public record Query(
        String question,
        List<String> allowedDocumentIds,
        List<Offer> offers,
        List<History> history,
        String retrievalQuery,
        List<String> semanticSkuIds
    ) {}

    public record RecallRequest(String question, List<History> history) {}

    public record RecallResponse(String query, List<String> terms) {}

    public record ProductIndex(String productId, String merchantId, String title, String description, String categoryCode, List<String> specs) {}

    public record ProductIndexRequest(List<ProductIndex> products) {}

    public record ProductDeleteRequest(List<String> productIds) {}

    public record ProductSearch(String query, int limit) {}

    public record ProductSearchResult(List<String> productIds, String mode) {}

    public record Citation(String documentId, String chunkId, String title, String snippet, double score) {}

    public record Recommendation(String skuId, int quantity, String reason) {}

    public record Answer(
        String answer,
        String mode,
        String retrievalMode,
        String rewrittenQuery,
        String warning,
        List<Citation> citations,
        List<Recommendation> recommendations,
        long latencyMs
    ) {}

    public record Index(String documentId, String title, String content) {}

    public record Extract(String filename, String contentType, String base64) {}

    public record Extracted(String text) {}

    public record ProductIndexResult(int indexed, int unchanged, String mode) {}

    public record ProductDeleteResult(Integer deleted, String mode) {}

    public record KnowledgeIndexResult(Integer chunks, String mode) {}
}
