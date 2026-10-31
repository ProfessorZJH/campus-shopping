package cn.bugstack.ai.domain.shoppingai.service;

import java.util.regex.Pattern;

/** 服务知识问答不能被偶然召回的报价变成购买建议。 */
public final class ShoppingAnswerPolicy {

    private static final Pattern TOPIC = Pattern.compile("退款|退货|售后|自提|取货|营业|配送|支付|付款|发票|保修|使用");
    private static final Pattern QUESTION = Pattern.compile("怎么|如何|怎样|流程|规则|政策|说明|须知|多久|什么时候|哪里|能否|是否|能不能");

    private ShoppingAnswerPolicy() {}

    public static boolean knowledgeQuestion(String question) {
        return TOPIC.matcher(question).find() && QUESTION.matcher(question).find();
    }
}
