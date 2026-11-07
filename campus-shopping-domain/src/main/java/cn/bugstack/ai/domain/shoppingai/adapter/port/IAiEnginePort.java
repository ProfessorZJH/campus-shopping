package cn.bugstack.ai.domain.shoppingai.adapter.port;

import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import java.util.function.LongConsumer;

/** 远程 Python AI 引擎端口；与本地 Repository 明确分工。 */
public interface IAiEnginePort {
    cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO recall(
        String question,
        java.util.List<cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO> history
    );
    AiAnswerVO query(AiQueryEntity query);

    default AiAnswerVO query(AiQueryEntity query, boolean answerPreview) {
        return answerPreview ? query(query) : retrieve(query);
    }

    default AiAnswerVO retrieve(AiQueryEntity query) {
        return query(query);
    }

    /** 受控流式查询；供应商进度只以字节数回调，最终仍返回完整且已校验的答案。 */
    default AiAnswerVO queryStream(AiQueryEntity query, LongConsumer progress) {
        return query(query);
    }

    /** 只返回可能相关的商品ID，不包含价格与库存；故障时由调用者降级关键词检索。 */
    java.util.List<String> semanticProducts(String question, int limit);

    /** 保留语义检索返回的 1-based rank；旧实现默认按返回顺序标记为降级 rank。 */
    default java.util.List<cn.bugstack.ai.domain.shoppingai.model.valobj.SemanticProductRankVO> semanticProductRanks(String question, int limit) {
        var ids = semanticProducts(question, limit);
        var result = new java.util.ArrayList<cn.bugstack.ai.domain.shoppingai.model.valobj.SemanticProductRankVO>();
        for (int i = 0; i < ids.size(); i++) result.add(new cn.bugstack.ai.domain.shoppingai.model.valobj.SemanticProductRankVO(ids.get(i), i + 1, true));
        return java.util.List.copyOf(result);
    }

    /** 从 Java 商品领域获取公开快照以构建向量索引，不接受前端商品数据。 */
    void indexProducts(java.util.List<cn.bugstack.ai.domain.shoppingai.model.valobj.ProductIndexVO> products);
    void deleteProducts(java.util.List<String> productIds);
    void index(String documentId, String title, String content);
    void index(String documentId, String title, String content, boolean externalAllowed);

    default void index(String documentId, String title, String content, int documentVersion, boolean externalAllowed) {
        index(documentId, title, content, externalAllowed);
    }

    String extract(String filename, String contentType, byte[] bytes);
}
