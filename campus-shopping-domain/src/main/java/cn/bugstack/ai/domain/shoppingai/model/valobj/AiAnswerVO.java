package cn.bugstack.ai.domain.shoppingai.model.valobj;
import java.util.*;
import java.time.*;
/** 区分真实模型回答、本地演示和故障降级的返回值。 */
public record AiAnswerVO(String answer,String mode,String retrievalMode,String rewrittenQuery,String warning,List<AiCitationVO> citations,List<AiRecommendationVO> recommendations,long latencyMs) {}
