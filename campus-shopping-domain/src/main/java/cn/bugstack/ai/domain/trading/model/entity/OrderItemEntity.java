package cn.bugstack.ai.domain.trading.model.entity;
import java.util.*;
import java.time.*;
/** 不可变订单行快照，商品后续改价不能覆盖成交价。 */
public record OrderItemEntity(String skuId, String title, String specKey, long unitPriceCent, int quantity, String imageUrl) {
    /** 老测试或历史数据没有图片时使用空快照，不回填当前商品图片。 */
    public OrderItemEntity(String skuId,String title,String specKey,long unitPriceCent,int quantity){
        this(skuId,title,specKey,unitPriceCent,quantity,"");
    }
}
