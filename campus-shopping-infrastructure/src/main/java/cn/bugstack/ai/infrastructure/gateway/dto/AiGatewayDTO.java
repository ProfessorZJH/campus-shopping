package cn.bugstack.ai.infrastructure.gateway.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** Java 与 Python 的明确 JSON 协议，不包含凭证或数据库连接信息。 */
public final class AiGatewayDTO {

    private AiGatewayDTO() {}

    public record Offer(
        String skuId,
        String merchantId,
        String title,
        String specKey,
        String description,
        java.util.Map<String, String> attributes,
        long priceCent,
        long available
    ) {
        public Offer(String skuId, String merchantId, String title, String specKey, String description, long priceCent, long available) {
            this(skuId, merchantId, title, specKey, description, java.util.Map.of(), priceCent, available);
        }
    }

    public record History(String role, String content) {}

    public record Query(
        String question,
        List<String> allowedDocumentIds,
        List<Offer> offers,
        List<History> history,
        String retrievalQuery,
        List<String> semanticSkuIds,
        List<String> externalDocumentIds
    ) {}

    public record RecallRequest(String question, List<History> history) {}

    public record RecallResponse(String query, List<String> terms) {}

    public record ProductIndex(String productId, String merchantId, String title, String description, String categoryCode, List<String> specs) {}

    public record ProductIndexRequest(List<ProductIndex> products) {}

    public record ProductDeleteRequest(List<String> productIds) {}

    public record ProductSearch(String query, int limit) {}

    public record ProductSearchResult(List<String> productIds, String mode, java.util.Map<String, Integer> productRanks) {
        public ProductSearchResult(List<String> productIds, String mode) {
            this(productIds, mode, java.util.Map.of());
        }
    }

    public record Citation(
        String documentId,
        String chunkId,
        String title,
        String snippet,
        double score,
        int documentVersion,
        int ordinal,
        String contentHash
    ) {
        /** 旧 Python 响应缺少新字段时，明确回落到旧协议值。 */
        @JsonCreator
        public Citation(
            @JsonProperty("documentId") String documentId,
            @JsonProperty("chunkId") String chunkId,
            @JsonProperty("title") String title,
            @JsonProperty("snippet") String snippet,
            @JsonProperty("score") double score,
            @JsonProperty("documentVersion") Integer documentVersion,
            @JsonProperty("ordinal") Integer ordinal,
            @JsonProperty("contentHash") String contentHash
        ) {
            this(
                documentId,
                chunkId,
                title,
                snippet,
                score,
                documentVersion == null ? 1 : documentVersion,
                ordinal == null ? -1 : ordinal,
                contentHash == null ? "" : contentHash
            );
        }

        public Citation(String documentId, String chunkId, String title, String snippet, double score) {
            this(documentId, chunkId, title, snippet, score, 1, -1, "");
        }
    }

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

    public record Index(String documentId, String title, String content, int documentVersion, boolean externalAllowed) {
        public Index(String documentId, String title, String content, boolean externalAllowed) {
            this(documentId, title, content, 1, externalAllowed);
        }

        public Index(String documentId, String title, String content) {
            this(documentId, title, content, 1, false);
        }
    }

    public record Extract(String filename, String contentType, String base64) {}

    public record Extracted(String text) {}

    public record ProductIndexResult(int indexed, int unchanged, String mode) {}

    public record ProductDeleteResult(Integer deleted, String mode) {}

    public record KnowledgeIndexResult(Integer chunks, String mode) {}
}
