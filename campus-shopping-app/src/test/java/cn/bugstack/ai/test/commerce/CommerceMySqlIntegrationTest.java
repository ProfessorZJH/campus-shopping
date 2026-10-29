package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.merchant.IMerchantAdmissionCase;
import cn.bugstack.ai.cases.trading.*;
import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.domain.identity.service.*;
import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.catalog.model.entity.*;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
import cn.bugstack.ai.domain.shoppingai.service.IConversationStateService;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeStateService;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.infrastructure.adapter.repository.AccessRepository;
import cn.bugstack.ai.types.exception.AppException;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 真实 MySQL + Spring 事务集成测试；绝不使用 H2 冒充行锁语义。
 * 只允许专用 campus_shopping_it 数据库；未配置时整类显式跳过。
 * 每个用例清空专用测试库业务表，因此不能连接开发/生产数据。
 */
@SpringBootTest(classes={Application.class,CommerceMySqlIntegrationTest.TimeConfig.class},properties={"campus.jobs.enabled=false","campus.bootstrap.enabled=false","campus.security.rate-limit-enabled=false"})
@ActiveProfiles("mysql-integration")
@EnabledIfEnvironmentVariable(named="MYSQL_TEST_URL",matches=".+")
class CommerceMySqlIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired IUserAccountService accounts;
    @Autowired IAccessService access;
    @Autowired IMerchantApplicationService applications;
    @Autowired IMerchantAdmissionCase admission;
    @Autowired ICatalogCase catalog;
    @Autowired ICatalogService catalogSearch;
    @Autowired ICheckoutCase checkout;
    @Autowired IOrderLifecycleCase life;
    @Autowired ICartCase cart;
    @Autowired IKnowledgeCase knowledge;
    @Autowired IShoppingAiCase ai;
    @Autowired IConversationStateService conversations;
    @Autowired IKnowledgeStateService knowledgeState;
    @Autowired MutableClock clock;
    @SpyBean AccessRepository accessRepository;
    String admin,owner,buyer,other;
    MerchantVO merchant;
    static final String PASSWORD="Test-only-commerce-password-123!";

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r){
        String url=System.getenv("MYSQL_TEST_URL");
        if(url==null||!url.matches("jdbc:mysql://[^/]+/campus_shopping_it(?:\\?.*)?"))throw new IllegalStateException("必须使用专用测试库 campus_shopping_it");
        String user=System.getenv("MYSQL_TEST_USERNAME"),pass=System.getenv("MYSQL_TEST_PASSWORD");
        if(user==null||pass==null)throw new IllegalStateException("未设置测试数据库凭据");
        r.add("spring.datasource.url",()->url);r.add("spring.datasource.username",()->user);r.add("spring.datasource.password",()->pass);
        r.add("spring.datasource.driver-class-name",()->"com.mysql.cj.jdbc.Driver");r.add("spring.sql.init.mode",()->"always");r.add("spring.sql.init.schema-locations",()->"classpath:schema.sql");r.add("spring.sql.init.data-locations",()->"classpath:data.sql");
    }
    @BeforeEach void fixture(){
        assertEquals("campus_shopping_it",jdbc.queryForObject("SELECT DATABASE()",String.class));
        // 固定表清单，绝不拼接用户输入。JUnit 默认顺序执行，CI 不启用并行测试类。
        for(String table:List.of("ai_proposal","ai_message","ai_conversation","ai_document","ai_document_root","ai_knowledge_base","ful_pickup_verification","ful_pickup_task","trd_refund","trd_after_sale","trd_payment","trd_order_item","trd_order","trd_checkout_request","trd_cart_item","trd_cart_owner","inv_stock_movement","inv_reservation","inv_stock_balance","cat_sku","cat_product","iam_invitation","iam_merchant_membership","iam_merchant_role_permission","iam_merchant_role","iam_platform_role","sys_audit","mer_store","mer_merchant","mer_application","iam_user"))jdbc.update("DELETE FROM "+table);
        clock.now=Instant.parse("2026-10-28T04:00:00Z");
        admin=accounts.register("testadmin",PASSWORD,"测试管理员").getUserId();
        owner=accounts.register("testowner",PASSWORD,"测试经营者").getUserId();
        buyer=accounts.register("testbuyer",PASSWORD,"测试买家").getUserId();
        other=accounts.register("testother",PASSWORD,"其他买家").getUserId();
        access.bootstrapAdmin(admin);
        merchant=open(owner,"测试文具商户");
    }
    private MerchantVO open(String applicant,String name){var a=applications.submitDetailed(applicant,new AdmissionCommandEntity(name,"文具","联系人","10000000000","测试门店","图书馆一层"),UUID.randomUUID().toString());return admission.approve(admin,a.getApplicationId());}
    private ProductAggregate product(int quantity){
        var p=catalog.create(owner,merchant.id(),new ProductCreateEntity("考试中性笔","黑色书写","stationery","",List.of(new ProductSkuEntity(null,"一盒",1200,"ACTIVE",0))));
        catalog.publish(owner,merchant.id(),p.getId(),true);
        if(quantity>0)catalog.replenish(owner,merchant.id(),p.getSkus().get(0).id(),quantity,UUID.randomUUID().toString());
        return catalog.publicDetail(p.getId());
    }
    /** 排序必须发生在 SQL LIMIT/OFFSET 之前：价格与库存结果跨页稳定，COUNT 不受影响。 */
    @Test void catalogGlobalSortOrdersEntireResultBeforePaging(){
        List<String> ids=new ArrayList<>();
        for(int i=0;i<22;i++){
            var p=catalog.create(owner,merchant.id(),new ProductCreateEntity("排序测试商品"+i,"","stationery","",
                List.of(new ProductSkuEntity(null,"单规格",1000L+i*20L,"ACTIVE",0))));
            catalog.publish(owner,merchant.id(),p.getId(),true);
            catalog.replenish(owner,merchant.id(),p.getSkus().get(0).id(),i+1,"sort-"+i);
            ids.add(p.getId());
        }
        assertEquals(22L,catalog.countPublicProducts(null,"排序测试商品",null));
        assertEquals(ids.subList(0,20),catalog.publicProductsSorted(null,"排序测试商品",null,1,20,"PRICE_ASC")
            .stream().map(ProductAggregate::getId).toList());
        assertEquals(ids.subList(20,22),catalog.publicProductsSorted(null,"排序测试商品",null,2,20,"PRICE_ASC")
            .stream().map(ProductAggregate::getId).toList());
        List<String> reversed=new ArrayList<>(ids);Collections.reverse(reversed);
        assertEquals(reversed.subList(0,20),catalog.publicProductsSorted(null,"排序测试商品",null,1,20,"STOCK_DESC")
            .stream().map(ProductAggregate::getId).toList());
        assertEquals(reversed.subList(20,22),catalog.publicProductsSorted(null,"排序测试商品",null,2,20,"STOCK_DESC")
            .stream().map(ProductAggregate::getId).toList());
        assertEquals(ids.subList(0,20),catalog.managedProductsSorted(owner,merchant.id(),"排序测试商品",null,"PUBLISHED",1,20,"PRICE_ASC")
            .stream().map(ProductAggregate::getId).toList());
        assertThrows(AppException.class,()->catalog.publicProductsSorted(null,"排序测试商品",null,1,20,"UNKNOWN"));
    }
    /** 商品超过 100 条时仍可召回老商品；召回只读取公开、已上架、有效 SKU。 */
    @Test void aiRecallSearchesWholePublishedCatalogInsteadOfNewestHundred(){
        var old=catalog.create(owner,merchant.id(),new ProductCreateEntity("无糖乌龙茶","无糖健康茶饮","stationery","",
            List.of(new ProductSkuEntity(null,"500ml瓶装",500,"ACTIVE",0))));
        catalog.publish(owner,merchant.id(),old.getId(),true);
        jdbc.update("UPDATE cat_product SET created_at='2025-01-01 00:00:00' WHERE id=?",old.getId());
        for(int i=0;i<120;i++){
            String productId=UUID.randomUUID().toString();String skuId=UUID.randomUUID().toString();
            jdbc.update("INSERT INTO cat_product(id,merchant_id,store_id,title,description,image_url,category_code,status,version,created_at) VALUES(?,?,?,?,?,'','stationery','PUBLISHED',0,'2026-10-28 00:00:00')",
                productId,merchant.id(),merchant.storeId(),"商品样例"+i,"普通商品");
            jdbc.update("INSERT INTO cat_sku(id,product_id,merchant_id,store_id,spec_key,price_cent,status,version) VALUES(?,?,?,?,?,100,'ACTIVE',0)",
                skuId,productId,merchant.id(),merchant.storeId(),"单品");
        }
        assertTrue(catalog.publicProducts(null,"",null,1,100).stream().noneMatch(p->p.getId().equals(old.getId())));
        var results=catalogSearch.recall(List.of("无糖","乌龙"),200);
        assertEquals(List.of(old.getId()),results.stream().map(ProductAggregate::getId).toList());
        var draft=catalog.create(owner,merchant.id(),new ProductCreateEntity("无糖草莓茶","","stationery","",
            List.of(new ProductSkuEntity(null,"单瓶",500,"ACTIVE",0))));
        assertEquals(List.of(old.getId()),catalogSearch.recall(List.of("无糖"),200).stream().map(ProductAggregate::getId).toList());
        assertThrows(AppException.class,()->catalogSearch.recall(List.of("%' OR 1=1 --"),200));
    }
    /** 向量索引返回的是不可信商品ID，必须重新按 MySQL 公开状态/商户状态校验。 */
    @Test void semanticRecallMustRevalidateCurrentCatalogPublicationAndMerchantStatus(){
        var published=product(2);
        var draft=catalog.create(owner,merchant.id(),new ProductCreateEntity("待发布语义商品","","stationery","",
            List.of(new ProductSkuEntity(null,"单份",500,"ACTIVE",0))));
        var ids=List.of(published.getId(),draft.getId());
        assertEquals(List.of(published.getId()),catalogSearch.recallByIds(ids).stream().map(ProductAggregate::getId).toList());
        catalog.publish(owner,merchant.id(),published.getId(),false);
        assertTrue(catalogSearch.recallByIds(ids).isEmpty());
        catalog.publish(owner,merchant.id(),published.getId(),true);
        jdbc.update("UPDATE mer_merchant SET status='SUSPENDED' WHERE id=?",merchant.id());
        assertTrue(catalogSearch.recallByIds(ids).isEmpty());
    }
    private CheckoutItemEntity item(ProductAggregate p){return new CheckoutItemEntity(p.getSkus().get(0).id(),1,p.getSkus().get(0).priceCent(),p.getVersion());}
    private OrderAggregate order(ProductAggregate p){return checkout.checkout(buyer,merchant.id(),List.of(item(p)),UUID.randomUUID().toString());}
    private long scalar(String sql,Object...args){return Objects.requireNonNull(jdbc.queryForObject(sql,Long.class,args));}
    private String code(Runnable action){try{action.run();return "0000";}catch(AppException e){return e.getCode();}}
    private List<String> race(Runnable a,Runnable b)throws Exception{
        var pool=Executors.newFixedThreadPool(2);var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        java.util.function.Function<Runnable,Callable<String>> call=work->()->{ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new IllegalStateException("等待超时");return code(work);};
        try{var x=pool.submit(call.apply(a));var y=pool.submit(call.apply(b));assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();return List.of(x.get(30,TimeUnit.SECONDS),y.get(30,TimeUnit.SECONDS));}finally{start.countDown();pool.shutdownNow();}
    }
    /** 关键字是字面子串，商品/商户/SKU/规格搜索及列表和 COUNT 必须等价。 */
    @Test void catalogLiteralSearchAndCountCoverMerchantSkuAndSpecification(){
        var percent=catalog.create(owner,merchant.id(),new ProductCreateEntity("校园100%果茶","特价批次","stationery","",
            List.of(new ProductSkuEntity(null,"限量规格搜索A",1200,"ACTIVE",0))));
        var underscore=catalog.create(owner,merchant.id(),new ProductCreateEntity("校园_书写套装","规格说明","stationery","",
            List.of(new ProductSkuEntity(null,"限量规格搜索B",1300,"ACTIVE",0))));
        catalog.publish(owner,merchant.id(),percent.getId(),true);
        catalog.publish(owner,merchant.id(),underscore.getId(),true);
        assertEquals(List.of(percent.getId()),catalog.publicProducts(null,"%",null,1,100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L,catalog.countPublicProducts(null,"%",null));
        assertEquals(List.of(underscore.getId()),catalog.publicProducts(null,"_",null,1,100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L,catalog.countPublicProducts(null,"_",null));
        assertEquals(2,catalog.publicProducts(null,"测试文具商户",null,1,100).size());
        assertEquals(2L,catalog.countPublicProducts(null,"测试文具商户",null));
        assertEquals(1,catalog.publicProducts(null,"限量规格搜索A",null,1,100).size());
        assertEquals(1L,catalog.countPublicProducts(null,"限量规格搜索A",null));
        String skuId=percent.getSkus().get(0).id();
        assertEquals(List.of(percent.getId()),catalog.publicProducts(null,skuId,null,1,100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L,catalog.countPublicProducts(null,skuId,null));
        assertEquals(1,catalog.managedProductsFiltered(owner,merchant.id(),"限量规格搜索B",null,"",1,100).size());
        assertEquals(1L,catalog.countManagedProductsFiltered(owner,merchant.id(),"限量规格搜索B",null,""));
    }

    @Test void approvalAtomicallyCreatesStoreAndOwnerAndIsIdempotent(){
        var second=admission.approve(admin,merchant.applicationId());assertEquals(merchant.id(),second.id());
        assertEquals(1,scalar("SELECT COUNT(*) FROM mer_merchant WHERE source_application_id=?",merchant.applicationId()));
        assertEquals(1,scalar("SELECT COUNT(*) FROM mer_store WHERE merchant_id=?",merchant.id()));
        access.requireMember(owner,merchant.id(),true);
    }
    @Test void approvalFailureRollsBackAllThreeDomains(){
        var a=applications.submitDetailed(other,new AdmissionCommandEntity("回滚测试","食品","联系人","10000000000","门店","东门"),"rollback");
        doThrow(new IllegalStateException("测试注入授权写入失败")).when(accessRepository).grantOwner(anyString(),eq(other),eq(a.getApplicationId()));
        assertThrows(IllegalStateException.class,()->admission.approve(admin,a.getApplicationId()));
        assertEquals("SUBMITTED",jdbc.queryForObject("SELECT status FROM mer_application WHERE application_id=?",String.class,a.getApplicationId()));
        assertEquals(0,scalar("SELECT COUNT(*) FROM mer_merchant WHERE source_application_id=?",a.getApplicationId()));
        assertEquals(0,scalar("SELECT COUNT(*) FROM iam_merchant_membership WHERE user_id=?",other));
    }
    @Test void ordinaryUserAndSelfReviewerCannotApprove(){
        var a=applications.submitDetailed(admin,new AdmissionCommandEntity("本人申请","食品","联系人","10000000000","门店","东门"),"self");
        assertEquals("A0006",code(()->admission.approve(buyer,a.getApplicationId())));
        assertEquals("M0003",code(()->admission.approve(admin,a.getApplicationId())));
    }
    @Test void lastStockOnlyOneConcurrentCheckoutSucceeds()throws Exception{
        var p=product(1);var result=race(()->checkout.checkout(buyer,merchant.id(),List.of(item(p)),"race-a"),()->checkout.checkout(other,merchant.id(),List.of(item(p)),"race-b"));
        assertEquals(1,result.stream().filter("0000"::equals).count());assertEquals(1,result.stream().filter("I0001"::equals).count());
        assertEquals(1,scalar("SELECT reserved FROM inv_stock_balance WHERE sku_id=?",p.getSkus().get(0).id()));assertEquals(1,scalar("SELECT COUNT(*) FROM trd_order"));
    }
    @Test void concurrentRetryCreatesOneOrderAndOneReservation()throws Exception{
        var p=product(5);var result=race(()->checkout.checkout(buyer,merchant.id(),List.of(item(p)),"same-key"),()->checkout.checkout(buyer,merchant.id(),List.of(item(p)),"same-key"));
        assertEquals(List.of("0000","0000"),result);assertEquals(1,scalar("SELECT COUNT(*) FROM trd_order"));assertEquals(1,scalar("SELECT COUNT(*) FROM inv_reservation"));
        assertEquals(1,scalar("SELECT reserved FROM inv_stock_balance WHERE sku_id=?",p.getSkus().get(0).id()));
    }
    @Test void stalePriceFailsWithoutLeavingReservationOrRequestGate(){
        var p=product(3);catalog.price(owner,merchant.id(),p.getId(),p.getSkus().get(0).id(),1500,p.getVersion());
        assertEquals("C0002",code(()->order(p)));assertEquals(0,scalar("SELECT COUNT(*) FROM trd_order"));assertEquals(0,scalar("SELECT COUNT(*) FROM trd_checkout_request"));assertEquals(0,scalar("SELECT COUNT(*) FROM inv_reservation"));
    }
    @Test void sameRequestDifferentContentsCannotCreateAnotherOrder(){
        var p=product(4);checkout.checkout(buyer,merchant.id(),List.of(item(p)),"same");
        var changed=new CheckoutItemEntity(item(p).skuId(),2,1200,p.getVersion());
        assertEquals("G0003",code(()->checkout.checkout(buyer,merchant.id(),List.of(changed),"same")));assertEquals(1,scalar("SELECT COUNT(*) FROM trd_order"));
    }
    @Test void paymentAndCancellationRaceLeavesOneConsistentOutcome()throws Exception{
        var p=product(2);var o=order(p);var result=race(()->life.pay(buyer,o.getId()),()->life.cancel(buyer,o.getId()));
        assertEquals(1,result.stream().filter("0000"::equals).count());String status=jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?",String.class,o.getId());
        if("PAID".equals(status)){assertEquals(1,scalar("SELECT COUNT(*) FROM trd_payment"));assertEquals(1,scalar("SELECT COUNT(*) FROM ful_pickup_task"));assertEquals(1,scalar("SELECT reserved FROM inv_stock_balance"));}
        else{assertEquals("CANCELED",status);assertEquals(0,scalar("SELECT COUNT(*) FROM trd_payment"));assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));}
    }
    @Test void expiryReleasesOnlyOnce(){var p=product(2);var o=order(p);clock.now=clock.now.plusSeconds(901);life.expire(o.getId());life.expire(o.getId());assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));assertEquals(1,scalar("SELECT COUNT(*) FROM inv_stock_movement WHERE type='RELEASE'"));assertEquals("T0001",code(()->life.pay(buyer,o.getId())));}
    @Test void pickupReissueInvalidatesOldTokenAndDuplicateIsSafe(){
        var p=product(2);var o=order(p);life.pay(buyer,o.getId());life.prepare(owner,merchant.id(),o.getId(),true);var old=life.token(buyer,o.getId());var current=life.token(buyer,o.getId());
        assertEquals("F0001",code(()->life.verify(owner,merchant.id(),o.getId(),old.token())));
        life.verify(owner,merchant.id(),o.getId(),current.token());life.verify(owner,merchant.id(),o.getId(),current.token());
        assertEquals(1,scalar("SELECT on_hand FROM inv_stock_balance"));assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));assertEquals(1,scalar("SELECT COUNT(*) FROM ful_pickup_verification"));
    }
    @Test void refundRequestAndPickupCannotBothWin()throws Exception{
        var p=product(2);var o=order(p);life.pay(buyer,o.getId());life.prepare(owner,merchant.id(),o.getId(),true);var token=life.token(buyer,o.getId());
        var result=race(()->life.requestRefund(buyer,o.getId(),"未提货退款"),()->life.verify(owner,merchant.id(),o.getId(),token.token()));assertEquals(1,result.stream().filter("0000"::equals).count());
        long requests=scalar("SELECT COUNT(*) FROM trd_after_sale");if(requests==1){life.decideRefund(owner,merchant.id(),o.getId(),true,"同意",false);assertEquals(2,scalar("SELECT on_hand FROM inv_stock_balance"));}else assertEquals(1,scalar("SELECT on_hand FROM inv_stock_balance"));assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));
    }
    @Test void approvedRefundReplaysWithoutDoubleReleaseOrPayout(){
        var p=product(2);var o=order(p);life.pay(buyer,o.getId());life.requestRefund(buyer,o.getId(),"取消购买");life.decideRefund(owner,merchant.id(),o.getId(),true,"同意",false);life.decideRefund(owner,merchant.id(),o.getId(),true,"同意",false);
        assertEquals(1,scalar("SELECT COUNT(*) FROM trd_refund"));assertEquals(2,scalar("SELECT on_hand FROM inv_stock_balance"));assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));assertEquals("T0001",code(()->life.verify(owner,merchant.id(),o.getId(),"invalid")));
    }
    /** 商户驳回后只能本人申诉，争议售后必须由平台裁决；退款仍只提交一次。 */
    @Test void rejectedAfterSaleAppealAndPlatformDecisionAreAtomic(){
        var p=product(2);
        var order=order(p);
        life.pay(buyer,order.getId());
        var first=life.requestRefund(buyer,order.getId(),"未提货");
        var duplicate=life.requestRefund(buyer,order.getId(),"未提货");
        assertEquals(first.id(),duplicate.id());
        assertEquals("T0004",code(()->life.requestRefund(buyer,order.getId(),"另一个理由")));

        life.decideRefund(owner,merchant.id(),order.getId(),false,"门店驳回",false);
        assertEquals("REJECTED",jdbc.queryForObject("SELECT status FROM trd_after_sale WHERE order_id=?",String.class,order.getId()));
        assertEquals("A0006",code(()->life.appeal(other,order.getId())));
        life.appeal(buyer,order.getId());
        life.appeal(buyer,order.getId());
        assertEquals("DISPUTED",jdbc.queryForObject("SELECT status FROM trd_after_sale WHERE order_id=?",String.class,order.getId()));
        assertEquals("A0006",code(()->life.decideRefund(owner,merchant.id(),order.getId(),true,"商户越权裁决",false)));

        life.decideRefund(admin,null,order.getId(),true,"平台核准",true);
        life.decideRefund(admin,null,order.getId(),true,"重复批准不会重复退款",true);
        assertEquals("APPROVED",jdbc.queryForObject("SELECT status FROM trd_after_sale WHERE order_id=?",String.class,order.getId()));
        assertEquals("平台核准",jdbc.queryForObject("SELECT decision_reason FROM trd_after_sale WHERE order_id=?",String.class,order.getId()));
        assertEquals("REFUNDED",jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?",String.class,order.getId()));
        assertEquals(1,scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(0,scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals(1,scalar("SELECT COUNT(*) FROM inv_stock_movement WHERE type='RELEASE'"));
    }

    /** 审核意见不合法应整体回滚，不能留下已批准售后、已退款订单或已释放库存。 */
    @Test void rejectedDecisionInputMustNotPartiallyApproveRefund(){
        var p=product(2);
        var order=order(p);
        life.pay(buyer,order.getId());
        life.requestRefund(buyer,order.getId(),"未提货");
        assertEquals("0002",code(()->life.decideRefund(owner,merchant.id(),order.getId(),true,"  ",false)));
        assertEquals("REQUESTED",jdbc.queryForObject("SELECT status FROM trd_after_sale WHERE order_id=?",String.class,order.getId()));
        assertEquals("PAID",jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?",String.class,order.getId()));
        assertEquals(1,scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals(0,scalar("SELECT COUNT(*) FROM trd_refund"));
        life.decideRefund(owner,merchant.id(),order.getId(),true,"审核同意",false);
        assertEquals("REFUNDED",jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?",String.class,order.getId()));
    }

    @Test void merchantIsolationAndRevocationAreCheckedAtOperationTime(){
        var p=product(2);assertEquals("A0006",code(()->catalog.replenish(other,merchant.id(),p.getSkus().get(0).id(),1,"bad")));
        var invitation=access.invite(owner,merchant.id(),"testother");access.accept(other,invitation.id());access.requireMember(other,merchant.id(),false);
        assertEquals("A0006",code(()->catalog.price(other,merchant.id(),p.getId(),p.getSkus().get(0).id(),1600,p.getVersion())));
        access.revoke(owner,merchant.id(),other);assertEquals("A0006",code(()->access.requireMember(other,merchant.id(),false)));
    }
    @Test void suspendBlocksNewOrdersButNotPaidFulfillment(){
        var p=product(2);var o=order(p);life.pay(buyer,o.getId());admission.setActive(admin,merchant.id(),false,"监管暂停");assertEquals("M0004",code(()->order(p)));
        life.prepare(owner,merchant.id(),o.getId(),true);var token=life.token(buyer,o.getId());life.verify(owner,merchant.id(),o.getId(),token.token());assertEquals("COMPLETED",jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?",String.class,o.getId()));
    }
    @Test void proposalConfirmationIsOwnedVersionedAndExactlyOnce(){
        var p=product(4);var conversation=conversations.conversation(buyer,null,"买笔");var proposal=new ProposalVO(UUID.randomUUID().toString(),buyer,conversation.id(),"PENDING",List.of(new ProposalItemVO(item(p).skuId(),merchant.id(),p.getTitle(),"一盒",1200,p.getVersion(),1)),null,clock.instant().plusSeconds(600));
        conversations.appendTurn(buyer,conversation.id(),"买笔","仅测试提案，不调用模型",proposal,"scope");
        assertEquals("G0001",code(()->ai.confirm(other,proposal.id(),List.of(item(p).skuId()))));
        ai.confirm(buyer,proposal.id(),List.of(item(p).skuId()));ai.confirm(buyer,proposal.id(),List.of(item(p).skuId()));assertEquals(1,cart.list(buyer).get(0).quantity());
    }
    /** 会话两条消息和导购提案原子提交：提案主键冲突时不能留下半轮聊天。 */
    @Test void proposalPersistenceFailureRollsBackEntireConversationTurn(){
        var conversation=conversations.conversation(buyer,null,"测试提案原子写入");
        var proposal=new ProposalVO(UUID.randomUUID().toString(),buyer,conversation.id(),"PENDING",
            List.of(),null,clock.instant().plusSeconds(600));
        conversations.appendTurn(buyer,conversation.id(),"第一轮","正常回复",proposal,"scope");
        assertEquals(2,scalar("SELECT COUNT(*) FROM ai_message WHERE conversation_id=?",conversation.id()));
        assertEquals(1,scalar("SELECT COUNT(*) FROM ai_proposal WHERE conversation_id=?",conversation.id()));

        // 第二轮复用相同 proposal ID 必然触发数据库主键冲突，验证整个 appendTurn 回滚。
        assertThrows(Exception.class,()->conversations.appendTurn(buyer,conversation.id(),
            "第二轮","应该一同回滚",proposal,"scope"));
        assertEquals(2,scalar("SELECT COUNT(*) FROM ai_message WHERE conversation_id=?",conversation.id()));
        assertEquals(1,scalar("SELECT COUNT(*) FROM ai_proposal WHERE conversation_id=?",conversation.id()));
    }
    @Test void knowledgeInternalScopeAndWithdrawalAreEffectiveImmediately(){
        var base=knowledge.createBase(owner,merchant.id(),"内部资料","MERCHANT_INTERNAL");var doc=knowledgeState.createDocument(null,base.id(),"内部说明","不得给普通买家看的内容");
        // 这里只验证 Java ACL/版本状态，索引构建由 Python 独立测试，不假装已调用向量库。
        knowledgeState.indexState(doc.id(),"READY","");knowledge.publish(owner,doc.id());assertTrue(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(doc.id())));assertTrue(knowledge.readableDocuments(buyer).stream().noneMatch(d->d.id().equals(doc.id())));
        knowledge.withdraw(owner,doc.id());assertTrue(knowledge.readableDocuments(owner).stream().noneMatch(d->d.id().equals(doc.id())));
    }
    /** MySQL 文档根锁与 Domain 发布规则：仅 READY 的最新版本生效，撤旧稿不能撤新稿。 */
    @Test void knowledgePublishRequiresLatestReadyVersionAndWithdrawalPreservesActivePointer(){
        var base = knowledge.createBase(owner,merchant.id(),"发布版本测试","MERCHANT_INTERNAL");
        var first = knowledgeState.createDocument(null,base.id(),"第一版","第一版内容");
        assertEquals("AI0003",code(()->knowledge.publish(owner,first.id())));
        knowledgeState.indexState(first.id(),"READY","");
        knowledge.publish(owner,first.id());
        assertTrue(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(first.id())));

        var next = knowledgeState.createDocument(first.rootId(),base.id(),"第二版","第二版内容");
        assertEquals("G0002",code(()->knowledge.publish(owner,first.id())));
        assertTrue(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(first.id())));
        assertEquals("AI0003",code(()->knowledge.publish(owner,next.id())));

        knowledgeState.indexState(next.id(),"READY","");
        knowledge.publish(owner,next.id());
        assertTrue(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(next.id())));
        assertFalse(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(first.id())));

        knowledge.withdraw(owner,first.id());
        assertTrue(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(next.id())));
        knowledge.withdraw(owner,next.id());
        assertFalse(knowledge.readableDocuments(owner).stream().anyMatch(d->d.id().equals(next.id())));
    }
    @Test void replenishRetryDoesNotAddTwice(){var p=product(0);String sku=item(p).skuId();catalog.replenish(owner,merchant.id(),sku,5,"once");catalog.replenish(owner,merchant.id(),sku,5,"once");assertEquals(5,scalar("SELECT on_hand FROM inv_stock_balance"));assertEquals("G0003",code(()->catalog.replenish(owner,merchant.id(),sku,6,"once")));}
    @Test void requestKeyIsCaseSensitive(){var p=product(4);checkout.checkout(buyer,merchant.id(),List.of(item(p)),"Key-A");checkout.checkout(buyer,merchant.id(),List.of(item(p)),"key-a");assertEquals(2,scalar("SELECT COUNT(*) FROM trd_order"));}

    @Test void profileIsOwnerOnlyAndAdminCanModerateWithoutOwnership(){
        assertEquals("A0006",code(()->admission.updateProfile(other,merchant.id(),"越权商户","门店","地点")));
        admission.updateProfile(owner,merchant.id(),"更新商户","校园新店","西门三楼");
        assertEquals("更新商户",jdbc.queryForObject("SELECT name FROM mer_merchant WHERE id=?",String.class,merchant.id()));
        assertEquals("西门三楼",jdbc.queryForObject("SELECT location FROM mer_store WHERE merchant_id=?",String.class,merchant.id()));
        var p=product(2);assertFalse(catalog.adminProducts(admin,null,"",1,20).isEmpty());
        assertEquals("A0006",code(()->catalog.adminProducts(other,null,"",1,20)));
        catalog.forceUnpublish(admin,p.getId());assertEquals("C0001",code(()->catalog.publicDetail(p.getId())));
    }

    /** 以固定时间明确验证到期边界，不靠 sleep 碰运气。 */
    static class MutableClock extends Clock {volatile Instant now=Instant.parse("2026-10-28T04:00:00Z");public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return now;}}
    @TestConfiguration static class TimeConfig {@Bean @Primary MutableClock testClock(){return new MutableClock();}}
}