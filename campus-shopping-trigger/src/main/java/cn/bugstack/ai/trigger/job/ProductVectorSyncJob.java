package cn.bugstack.ai.trigger.job;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProductIndexVO;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.*;
/** 有条件启动的公开商品向量增量同步；失败后下周期重试，AI 问答仍可走关键词召回。 */
@Component
@ConditionalOnProperty(name="campus.ai.product-sync.enabled",havingValue="true")
public class ProductVectorSyncJob {
 private final ICatalogService catalog;
 private final IAiEnginePort ai;
 public ProductVectorSyncJob(ICatalogService catalog,IAiEnginePort ai){this.catalog=catalog;this.ai=ai;}
 @Scheduled(initialDelayString="${campus.ai.product-sync.initial-delay-ms:60000}",fixedDelayString="${campus.ai.product-sync.period-ms:600000}")
 public void refresh(){
  try{
   for(int page=1;page<=1000;page++){
    var products=catalog.search(null,"",null,true,page,40);
    var batch=products.stream().filter(p->p.getSkus().stream().anyMatch(s->"ACTIVE".equals(s.status())))
     .map(p->new ProductIndexVO(p.getId(),p.getMerchantId(),p.getTitle(),p.getDescription(),p.getCategoryCode(),
       p.getSkus().stream().filter(s->"ACTIVE".equals(s.status())).map(s->s.specKey()).toList())).toList();
    if(!batch.isEmpty())ai.indexProducts(batch);
    if(products.size()<40)break;
   }
  }catch(RuntimeException ignored){/* 不记录下游响应中的任何凭据或商品详情；下次周期重试 */}
 }
}
