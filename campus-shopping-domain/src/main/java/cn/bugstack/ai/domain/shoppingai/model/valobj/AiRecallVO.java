package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.util.List;

/** AI 检索意图只作为召回提示，不含授权商品或交易事实。 */
public record AiRecallVO(String query, List<String> terms) {}
