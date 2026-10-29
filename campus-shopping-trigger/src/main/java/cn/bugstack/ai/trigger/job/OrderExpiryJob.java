package cn.bugstack.ai.trigger.job;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;import cn.bugstack.ai.domain.trading.service.ITradingService;
import jakarta.annotation.Resource;import lombok.extern.slf4j.Slf4j;import org.springframework.scheduling.annotation.Scheduled;import org.springframework.stereotype.Component;
/** 每条候选在独立用例事务中重新检查截止时间和状态，多个实例重复扫描仍安全。 */
@Slf4j @Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="campus.jobs.enabled",havingValue="true",matchIfMissing=true)
public class OrderExpiryJob {
 @Resource private ITradingService trading;@Resource private IOrderLifecycleCase lifecycle;
 @Scheduled(fixedDelayString="${campus.order.expiry-scan-ms:15000}")
 public void closeExpired(){
  try{for(String id:trading.expired())try{lifecycle.expire(id);}catch(Exception e){log.error("订单关闭失败，将在后续扫描重试 orderId={}",id,e);}}
  catch(Exception e){log.error("订单到期扫描失败",e);}
 }
}
