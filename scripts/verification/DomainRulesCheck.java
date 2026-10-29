import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.inventory.model.aggregate.StockBalanceAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.fulfillment.model.aggregate.PickupAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.exception.AppException;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.*;

/** 编译并执行真正生产领域类，不制作 Spring、Lombok 或数据库替身。 */
public final class DomainRulesCheck {
    private static final Instant NOW=Instant.parse("2026-10-28T04:00:00Z");
    private static final List<String> PASSED=new ArrayList<>();
    private static void check(String label, boolean condition){if(!condition)throw new AssertionError(label);PASSED.add(label);}
    private static void fails(String label,ResponseCode code,Runnable action){
        try{action.run();throw new AssertionError(label+": 未抛出预期异常");}
        catch(AppException e){if(!code.getCode().equals(e.getCode()))throw new AssertionError(label+": 错误码="+e.getCode());PASSED.add(label);}
    }
    private static ProductAggregate product(){return new ProductAggregate("p1","m1","s1","考试中性笔","黑色笔芯","stationery","","DRAFT",0,List.of(new ProductSkuEntity("sku1","黑色一盒",1200,"ACTIVE",0)));}
    private static OrderAggregate order(){return new OrderAggregate("o1","u1","m1","s1",List.of(new OrderItemEntity("sku1","考试中性笔","黑色一盒",1200,2)),"PENDING_PAYMENT",NOW.plusSeconds(900),NOW);}
    private static PickupAggregate pickup(){return new PickupAggregate(new PickupVO("f1","o1","m1","s1","u1","WAIT_PREP",null,null));}
    public static void main(String[]args){
        ProductAggregate p=product();p.publish();check("商品具有有效规格才能上架",p.getStatus().equals("PUBLISHED"));
        fails("禁止其他商户修改商品",ResponseCode.AUTH_FORBIDDEN,()->p.requireOwner("m2"));
        fails("商品规格不能重复",ResponseCode.SKU_DUPLICATE,()->p.addSku(new ProductSkuEntity("sku2","黑色一盒",1200,"ACTIVE",0)));
        fails("商品售价必须大于零",ResponseCode.ILLEGAL_PARAMETER,()->p.changePrice("sku1",0,0));
        fails("商品报价旧版本拒绝改价",ResponseCode.STATE_CONFLICT,()->p.changePrice("sku1",1400,9));
        p.changePrice("sku1",1400,0);check("合法改价更新规格版本",p.getSkus().get(0).priceCent()==1400&&p.getSkus().get(0).version()==1);
        fails("图片地址不允许外部URL",ResponseCode.ILLEGAL_PARAMETER,()->p.changeInfo("新标题","","stationery","https://example.com/a.png",0));
        p.unpublish();check("商品可下架",p.getStatus().equals("UNPUBLISHED"));
        try{p.getSkus().clear();throw new AssertionError("内部规格集合被泄漏");}catch(UnsupportedOperationException ok){check("聚合只返回不可变规格集合",true);}
        StockBalanceAggregate stock=new StockBalanceAggregate(5,0);stock.reserve(3);check("预占不减少实物库存",stock.getOnHand()==5&&stock.getReserved()==3&&stock.available()==2);
        fails("不能超额预占",ResponseCode.STOCK_NOT_ENOUGH,()->stock.reserve(3));check("失败预占不改变库存",stock.getReserved()==3&&stock.getOnHand()==5);
        stock.release(1);check("释放恢复可售库存",stock.available()==3&&stock.getReserved()==2);
        stock.consume(2);check("核销同时减少实物与预占",stock.getOnHand()==3&&stock.getReserved()==0);
        fails("不能重复释放不存在的预占",ResponseCode.STOCK_STATE_INVALID,()->stock.release(1));
        fails("不能无预占出库",ResponseCode.STOCK_STATE_INVALID,()->stock.consume(1));
        fails("库存数量不能为零",ResponseCode.ILLEGAL_PARAMETER,()->stock.replenish(0));
        fails("库存初始状态不能为负",ResponseCode.STOCK_STATE_INVALID,()->new StockBalanceAggregate(0,1));
        Random random=new Random(27);StockBalanceAggregate r=new StockBalanceAggregate(30,0);long expectedHand=30,expectedReserved=0;
        for(int i=0;i<5000;i++){int q=1+random.nextInt(5);switch(random.nextInt(4)){
            case 0:r.replenish(q);expectedHand+=q;break;
            case 1:if(expectedHand-expectedReserved>=q){r.reserve(q);expectedReserved+=q;}break;
            case 2:if(expectedReserved>=q){r.release(q);expectedReserved-=q;}break;
            case 3:if(expectedReserved>=q){r.consume(q);expectedReserved-=q;expectedHand-=q;}break;
        }if(r.getOnHand()!=expectedHand||r.getReserved()!=expectedReserved||r.available()<0)throw new AssertionError("库存随机序列第"+i+"步不一致");}
        check("5000步确定种子库存随机序列保持不变量",true);
        OrderAggregate o=order();check("订单按整数分计算快照金额",o.getTotalCent()==2400);
        fails("订单只允许本人操作",ResponseCode.AUTH_FORBIDDEN,()->o.requireBuyer("u2"));
        check("有效付款第一次改变状态",o.pay(NOW));check("重复付款不重复执行",!o.pay(NOW.plusSeconds(60)));
        fails("已付款订单不可走未付款取消",ResponseCode.ORDER_STATE_INVALID,o::cancel);
        check("已付款订单不会被超时任务关闭",!o.expire(NOW.plusSeconds(901)));
        o.complete();check("自提后订单完成",o.getStatus().equals("COMPLETED"));
        fails("已提货订单不能走未提货退款",ResponseCode.ORDER_STATE_INVALID,o::refund);
        OrderAggregate expired=order();fails("付款到期边界拒绝付款",ResponseCode.ORDER_EXPIRED,()->expired.pay(NOW.plusSeconds(900)));
        check("到期订单可以关闭",expired.expire(NOW.plusSeconds(900)));check("关闭重复执行没有副作用",!expired.expire(NOW.plusSeconds(901)));
        fails("已关闭订单不可重新付款",ResponseCode.ORDER_STATE_INVALID,()->expired.pay(NOW));
        OrderAggregate cancelled=order();check("待付款订单主动取消",cancelled.cancel());check("取消请求可幂等重放",!cancelled.cancel());
        OrderAggregate refunded=order();refunded.pay(NOW);refunded.refund();check("已支付未提货可以退款",refunded.getStatus().equals("REFUNDED"));
        fails("退款后不允许继续核销",ResponseCode.ORDER_STATE_INVALID,refunded::complete);
        fails("一单不能包含重复SKU",ResponseCode.ILLEGAL_PARAMETER,()->new OrderAggregate("o","u","m","s",List.of(new OrderItemEntity("sku","a","s",1,1),new OrderItemEntity("sku","a","s",1,1)),"PENDING_PAYMENT",NOW,NOW));
        fails("每个SKU数量上限99",ResponseCode.ILLEGAL_PARAMETER,()->new OrderAggregate("o","u","m","s",List.of(new OrderItemEntity("sku","a","s",1,100)),"PENDING_PAYMENT",NOW,NOW));
        PickupAggregate f=pickup();fails("未备货不能领取凭证",ResponseCode.PICKUP_NOT_READY,()->f.issue("long-token",NOW.plusSeconds(60)));
        f.prepare();f.ready();f.issue("long-random-test-token",NOW.plusSeconds(60));
        check("自提凭证只保存摘要",!f.view().credentialHash().equals("long-random-test-token")&&f.view().credentialHash().length()==64);
        fails("错误令牌不能核销",ResponseCode.PICKUP_INVALID,()->f.verify("another",NOW));
        check("有效令牌首次核销成功",f.verify("long-random-test-token",NOW));check("相同凭证核销重试不再次出库",!f.verify("long-random-test-token",NOW.plusSeconds(120)));
        fails("已交付自提任务不能取消",ResponseCode.ORDER_STATE_INVALID,f::cancel);
        PickupAggregate changed=pickup();changed.ready();changed.issue("old-token",NOW.plusSeconds(60));changed.issue("new-token",NOW.plusSeconds(60));
        fails("重新签发令牌使旧令牌无效",ResponseCode.PICKUP_INVALID,()->changed.verify("old-token",NOW));
        fails("凭证到期边界拒绝核销",ResponseCode.PICKUP_INVALID,()->changed.verify("new-token",NOW.plusSeconds(60)));
        PickupAggregate cancel=pickup();cancel.ready();cancel.issue("token",NOW.plusSeconds(60));cancel.cancel();
        fails("已退款自提任务不能核销",ResponseCode.PICKUP_NOT_READY,()->cancel.verify("token",NOW));
        ProposalAggregate a=new ProposalAggregate("u1",NOW.plusSeconds(600),"PENDING",null);
        fails("推荐提案只能由本人确认",ResponseCode.AUTH_FORBIDDEN,()->a.confirm("u2","selection1",NOW));
        check("有效提案第一次确认",a.confirm("u1","selection1",NOW));check("同一选择重试不重复加购",!a.confirm("u1","selection1",NOW.plusSeconds(900)));
        fails("已确认提案不能更换选择重放",ResponseCode.REQUEST_CONFLICT,()->a.confirm("u1","selection2",NOW));
        fails("已确认提案不能拒绝",ResponseCode.STATE_CONFLICT,()->a.reject("u1"));
        ProposalAggregate b=new ProposalAggregate("u1",NOW,"PENDING",null);
        fails("提案有效期边界拒绝确认",ResponseCode.PROPOSAL_EXPIRED,()->b.confirm("u1","selection",NOW));
        ProposalAggregate c=new ProposalAggregate("u1",NOW.plusSeconds(600),"PENDING",null);c.reject("u1");
        fails("拒绝后不能再确认提案",ResponseCode.STATE_CONFLICT,()->c.confirm("u1","selection",NOW));
        check("指纹编码避免分隔歧义",!Fingerprints.of("a","bc").equals(Fingerprints.of("ab","c")));
        check("同一输入指纹稳定",Fingerprints.of("m","sku",2,100).equals(Fingerprints.of("m","sku",2,100)));
        Throwable cause=new IllegalStateException("private-system-error");AppException ex=new AppException("A1","公开提示",cause);
        check("业务异常保留消息与原始原因",ex.getMessage().equals("公开提示")&&ex.getCause()==cause);
        for(String label:PASSED)System.out.println("PASS "+label);
        System.out.println("PRODUCTION_DOMAIN_CHECKS="+PASSED.size());
    }
}
