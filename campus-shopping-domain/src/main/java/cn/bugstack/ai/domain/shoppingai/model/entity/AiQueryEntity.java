package cn.bugstack.ai.domain.shoppingai.model.entity;

import java.time.*;
import java.util.*;

/** 检索白名单只能由受控 Java 用例构造。 */
public record AiQueryEntity(
    String question,
    List<String> allowedDocumentIds,
    List<cn.bugstack.ai.domain.shoppingai.model.valobj.AiOfferVO> offers,
    List<cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO> history,
    String retrievalQuery,
    List<String> semanticSkuIds
) {
    public AiQueryEntity(
        String question,
        List<String> allowedDocumentIds,
        List<cn.bugstack.ai.domain.shoppingai.model.valobj.AiOfferVO> offers,
        List<cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO> history,
        String retrievalQuery
    ) {
        this(question, allowedDocumentIds, offers, history, retrievalQuery, List.of());
    }

    public AiQueryEntity(
        String question,
        List<String> allowedDocumentIds,
        List<cn.bugstack.ai.domain.shoppingai.model.valobj.AiOfferVO> offers,
        List<cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO> history
    ) {
        this(question, allowedDocumentIds, offers, history, "", List.of());
    }
}
