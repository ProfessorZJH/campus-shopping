package cn.bugstack.ai.domain.shoppingai.model.valobj;
import java.util.*;
import java.time.*;
/** 用户确认前冻结的商品建议快照，非最终成交价格。 */
public record ProposalItemVO(String skuId,String merchantId,String title,String specKey,long priceCent,long quoteVersion,int quantity,String imageUrl) {
    /** 兼容历史 Java 调用；反序列化旧 JSON 缺少 imageUrl 时允许为 null。 */
    public ProposalItemVO(String skuId,String merchantId,String title,String specKey,long priceCent,long quoteVersion,int quantity){
        this(skuId,merchantId,title,specKey,priceCent,quoteVersion,quantity,"");
    }
}
