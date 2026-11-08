package cn.bugstack.ai.domain.catalog.service;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import java.util.List;

/** ShoppingAI 候选只读能力；不提供商品写入、展示查询或交易锁定。 */
public interface ICatalogCandidateQuery {
    List<ProductCandidateSnapshot> candidateRecall(List<String> terms, int limit);

    List<ProductCandidateSnapshot> candidateRecallByIds(List<String> ids);

    /** 读取候选 SKU 的当前公开报价；不锁定、不写入。 */
    List<SkuOfferVO> availableOffers(List<String> ids);
}
