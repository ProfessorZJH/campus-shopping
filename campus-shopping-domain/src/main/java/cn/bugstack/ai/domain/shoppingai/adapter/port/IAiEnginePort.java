package cn.bugstack.ai.domain.shoppingai.adapter.port;

import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;

/** 远程 Python AI 引擎端口；与本地 Repository 明确分工。 */
public interface IAiEnginePort {
    cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO recall(
        String question,
        java.util.List<cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO> history
    );
    AiAnswerVO query(AiQueryEntity query);
    /** 只返回可能相关的商品ID，不包含价格与库存；故障时由调用者降级关键词检索。 */
    java.util.List<String> semanticProducts(String question, int limit);
    /** 从 Java 商品领域获取公开快照以构建向量索引，不接受前端商品数据。 */
    void indexProducts(java.util.List<cn.bugstack.ai.domain.shoppingai.model.valobj.ProductIndexVO> products);
    void deleteProducts(java.util.List<String> productIds);
    void index(String documentId, String title, String content);
    void index(String documentId, String title, String content, boolean externalAllowed);
    String extract(String filename, String contentType, byte[] bytes);
}
