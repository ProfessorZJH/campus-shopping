package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import java.util.List;
import java.util.regex.Pattern;

/** 服务知识问答不能被偶然召回的报价变成购买建议。 */
public final class ShoppingAnswerPolicy {

    private static final Pattern TOPIC = Pattern.compile("退款|退货|售后|自提|取货|营业|配送|支付|付款|发票|保修|使用|备货|到货");
    private static final Pattern QUESTION = Pattern.compile("怎么|如何|怎样|流程|规则|政策|说明|须知|多久|什么时候|哪里|能否|是否|能不能");
    private static final Pattern SERVICE_INQUIRY = Pattern.compile(
        "几点|时间|怎么|如何|怎样|流程|规则|政策|说明|须知|多久|什么时候|哪里|在哪|地址|位置|能否|是否|能不能"
    );
    private static final Pattern PERSONAL_ORDER_INQUIRY = Pattern.compile("我的订单|订单进度|做好了吗|备好没|取餐码|取餐号|自提进度");
    private static final Pattern FAKE_EXECUTION = Pattern.compile("已下单|已付款|已支付|已扣款|已退款|完成下单|完成支付|已自动加购|已帮你下单");

    private ShoppingAnswerPolicy() {}

    public static boolean personalOrderInquiry(String question) {
        return question != null && PERSONAL_ORDER_INQUIRY.matcher(question).find();
    }

    public static boolean isSafeNaturalAnswer(String text) {
        if (text == null || text.isBlank()) return false;
        return !FAKE_EXECUTION.matcher(text).find();
    }

    public static boolean knowledgeQuestion(String question) {
        return TOPIC.matcher(question).find() && QUESTION.matcher(question).find();
    }

    /** 混合提问（同时选购商品与询问自提/售后规则）时附带已校验知识摘要。 */
    public static boolean hasServiceInquiry(String question) {
        return TOPIC.matcher(question).find() && SERVICE_INQUIRY.matcher(question).find();
    }

    public static String evidenceBrief(List<AiCitationVO> citations) {
        if (citations.isEmpty()) return "";
        return (
            "根据当前允许访问的知识资料：\n" +
            citations
                .stream()
                .limit(2)
                .map(c -> "《" + c.title() + "》：" + c.snippet())
                .collect(java.util.stream.Collectors.joining("\n"))
        );
    }

    public static String evidenceAnswer(List<AiCitationVO> citations) {
        if (citations.isEmpty()) return "没有找到可核实且有权限访问的资料，请补充问题。未执行任何购物操作，订单状态请查看订单页。";
        return (
            "根据当前允许访问的知识资料：" +
            citations
                .stream()
                .limit(3)
                .map(c -> "《" + c.title() + "》：" + c.snippet())
                .collect(java.util.stream.Collectors.joining("；")) +
            "。以上为资料说明，未执行购物操作；订单状态以订单页为准。"
        );
    }
}
