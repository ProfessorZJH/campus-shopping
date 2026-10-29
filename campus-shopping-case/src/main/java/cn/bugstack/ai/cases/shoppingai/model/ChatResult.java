package cn.bugstack.ai.cases.shoppingai.model;

import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;

/** 跨域用例结果，由 Trigger 映射为对外 DTO。 */
public record ChatResult(String conversationId, AiAnswerVO answer, ProposalVO proposal) {}
