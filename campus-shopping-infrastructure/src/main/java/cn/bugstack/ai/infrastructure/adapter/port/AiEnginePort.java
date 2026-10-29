package cn.bugstack.ai.infrastructure.adapter.port;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.infrastructure.gateway.AiGatewayService;
import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.stereotype.Component;

/** 远程协议防腐适配，不访问 MySQL 或业务 DAO。 */
@Component
public class AiEnginePort implements IAiEnginePort {

    @Resource
    private AiGatewayService gateway;

    public AiRecallVO recall(String question, List<MessageVO> history) {
        var response = gateway.recall(
            new AiGatewayDTO.RecallRequest(
                question,
                history
                    .stream()
                    .map(m -> new AiGatewayDTO.History(m.role(), m.content()))
                    .toList()
            )
        );
        require(response != null && text(response.query(), 2000) && response.terms() != null && response.terms().size() <= 8, ResponseCode.AI_UNAVAILABLE);
        require(
            response
                .terms()
                .stream()
                .allMatch(t -> text(t, 20) && t.length() >= 2 && t.matches("[\\p{L}\\p{N}_-]+")),
            ResponseCode.AI_UNAVAILABLE
        );
        return new AiRecallVO(response.query(), List.copyOf(response.terms()));
    }

    public AiAnswerVO query(AiQueryEntity query) {
        var response = gateway.query(
            new AiGatewayDTO.Query(
                query.question(),
                query.allowedDocumentIds(),
                query
                    .offers()
                    .stream()
                    .map(o -> new AiGatewayDTO.Offer(o.skuId(), o.merchantId(), o.title(), o.specKey(), o.description(), o.priceCent(), o.available()))
                    .toList(),
                query
                    .history()
                    .stream()
                    .map(m -> new AiGatewayDTO.History(m.role(), m.content()))
                    .toList(),
                query.retrievalQuery(),
                query.semanticSkuIds()
            )
        );
        require(
            response != null &&
                response.answer() != null &&
                response.answer().length() <= 10000 &&
                response.citations() != null &&
                response.citations().size() <= 20 &&
                response.recommendations() != null &&
                response.recommendations().size() <= 20,
            ResponseCode.AI_UNAVAILABLE
        );
        require(
            Set.of("LOCAL_RETRIEVAL_DEMO", "LLM", "LOCAL_FALLBACK").contains(Objects.toString(response.mode(), "")) &&
                Set.of("REMOTE_EMBEDDING", "LOCAL_CHAR_NGRAM_DEMO", "BM25_DEGRADED").contains(Objects.toString(response.retrievalMode(), "")) &&
                optional(response.rewrittenQuery(), 2000) &&
                optional(response.warning(), 1000) &&
                response.latencyMs() >= 0,
            ResponseCode.AI_UNAVAILABLE
        );
        require(
            response
                .citations()
                .stream()
                .allMatch(
                    c ->
                        c != null &&
                        text(c.documentId(), 64) &&
                        text(c.chunkId(), 100) &&
                        text(c.title(), 120) &&
                        text(c.snippet(), 500) &&
                        Double.isFinite(c.score())
                ),
            ResponseCode.AI_UNAVAILABLE
        );
        require(
            response
                .recommendations()
                .stream()
                .allMatch(r -> r != null && text(r.skuId(), 64) && r.quantity() >= 1 && r.quantity() <= 99 && optional(r.reason(), 1000)),
            ResponseCode.AI_UNAVAILABLE
        );
        return new AiAnswerVO(
            response.answer(),
            response.mode(),
            response.retrievalMode(),
            response.rewrittenQuery(),
            response.warning(),
            response
                .citations()
                .stream()
                .map(c -> new AiCitationVO(c.documentId(), c.chunkId(), c.title(), c.snippet(), c.score()))
                .toList(),
            response
                .recommendations()
                .stream()
                .map(r -> new AiRecommendationVO(r.skuId(), r.quantity(), r.reason()))
                .toList(),
            response.latencyMs()
        );
    }

    public List<String> semanticProducts(String query, int limit) {
        require(query != null && !query.isBlank() && query.length() <= 2000 && limit >= 1 && limit <= 100, ResponseCode.ILLEGAL_PARAMETER);
        var result = gateway.semanticProducts(new AiGatewayDTO.ProductSearch(query, limit));
        require(result != null && result.productIds() != null && result.productIds().size() <= limit, ResponseCode.AI_UNAVAILABLE);
        require(
            result
                .productIds()
                .stream()
                .allMatch(id -> text(id, 64)),
            ResponseCode.AI_UNAVAILABLE
        );
        return List.copyOf(result.productIds());
    }

    public void indexProducts(List<ProductIndexVO> products) {
        require(products != null && !products.isEmpty() && products.size() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        gateway.indexProducts(
            new AiGatewayDTO.ProductIndexRequest(
                products
                    .stream()
                    .map(p -> new AiGatewayDTO.ProductIndex(p.productId(), p.merchantId(), p.title(), p.description(), p.categoryCode(), p.specs()))
                    .toList()
            )
        );
    }

    public void deleteProducts(List<String> ids) {
        require(
            ids != null && !ids.isEmpty() && ids.size() <= 100 && ids.stream().allMatch(id -> id != null && !id.isBlank() && id.length() <= 64),
            ResponseCode.ILLEGAL_PARAMETER
        );
        gateway.deleteProducts(new AiGatewayDTO.ProductDeleteRequest(ids));
    }

    public void index(String id, String title, String content) {
        gateway.index(new AiGatewayDTO.Index(id, title, content));
    }

    public String extract(String filename, String type, byte[] bytes) {
        return gateway.extract(new AiGatewayDTO.Extract(filename, type, Base64.getEncoder().encodeToString(bytes)));
    }

    private static boolean text(String value, int max) {
        return value != null && !value.isBlank() && value.length() <= max;
    }

    private static boolean optional(String value, int max) {
        return value == null || value.length() <= max;
    }
}
