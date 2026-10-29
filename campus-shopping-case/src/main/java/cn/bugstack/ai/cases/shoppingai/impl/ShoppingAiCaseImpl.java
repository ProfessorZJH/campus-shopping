package cn.bugstack.ai.cases.shoppingai.impl;
import cn.bugstack.ai.cases.shoppingai.*;import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.domain.shoppingai.service.IConversationStateService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalStateService;import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;import cn.bugstack.ai.domain.shoppingai.model.valobj.*;import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;import cn.bugstack.ai.domain.identity.service.IUserAccountService;import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.common.Fingerprints;import static cn.bugstack.ai.types.common.Checks.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;import org.springframework.beans.factory.annotation.Value;
import java.time.*;import java.util.*;import java.util.concurrent.locks.ReentrantLock;import java.util.stream.Collectors;
/** Java 负责复权、商品事实和用户确认；模型文本从不直接变成写命令。 */
@Service
public class ShoppingAiCaseImpl implements IShoppingAiCase {
 private final IConversationStateService conversations,IProposalStateService proposals;private final IAiEnginePort engine;private final IKnowledgeCase knowledge;private final ICatalogService catalog;private final IInventoryService inventory;private final IMerchantService merchants;private final IUserAccountService accounts;private final ICartService cart;private final Clock clock;
 private final ReentrantLock[] locks=new ReentrantLock[64];
 @Value("${campus.proposal.minutes:10}")private long proposalMinutes=10;
 public ShoppingAiCaseImpl(IConversationStateService conversations,IProposalStateService proposals,IAiEnginePort engine,IKnowledgeCase knowledge,ICatalogService catalog,IInventoryService inventory,IMerchantService merchants,IUserAccountService accounts,ICartService cart,Clock clock){this.conversations=conversations;this.proposals=proposals;this.engine=engine;this.knowledge=knowledge;this.catalog=catalog;this.inventory=inventory;this.merchants=merchants;this.accounts=accounts;this.cart=cart;this.clock=clock;for(int i=0;i<locks.length;i++)locks[i]=new ReentrantLock();}
 public ChatResult chat(String actor,String conversationId,String question){
  accounts.requireActive(actor);String q=text(question,"问题",2000);var conversation=conversations.conversation(actor,conversationId,q);var lock=locks[Math.floorMod(conversation.id().hashCode(),locks.length)];require(lock.tryLock(),ResponseCode.STATE_CONFLICT);
  try{return answer(actor,conversation.id(),q);}finally{lock.unlock();}
 }
 private ChatResult answer(String actor,String conversation,String question){
  var documents=knowledge.readableDocuments(actor);String fingerprint=scope(documents);List<MessageVO> history=safeHistory(actor,conversation,fingerprint,12);
  AiRecallVO recall=engine.recall(question,history);
  // 词面召回 + 可选 Milvus 语义召回：RRF 合并，商品状态仍须重新由 MySQL 校验。
  List<cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate> lexical=catalog.recall(recall.terms(),200);
  List<String> semanticIds=List.of();
  try{semanticIds=engine.semanticProducts(recall.query(),80);}catch(RuntimeException ignored){/* 向量依赖不可用时仅降级，不影响交易安全 */}
  var semantic=catalog.recallByIds(semanticIds);
  Map<String,Double> scores=new HashMap<>();
  Map<String,cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate> byProduct=new HashMap<>();
  for(int i=0;i<lexical.size();i++){
   var p=lexical.get(i);byProduct.put(p.getId(),p);scores.merge(p.getId(),1.0/(60+i+1),Double::sum);
  }
  Map<String,cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate> semanticMap=semantic.stream().collect(Collectors.toMap(p->p.getId(),p->p));
  for(int i=0;i<semanticIds.size();i++){
   String id=semanticIds.get(i);var p=semanticMap.get(id);if(p==null)continue;
   byProduct.put(id,p);scores.merge(id,1.0/(60+i+1),Double::sum);
  }
  var products=scores.entrySet().stream().sorted(Comparator.<Map.Entry<String,Double>>comparingDouble(Map.Entry::getValue).reversed().thenComparing(Map.Entry::getKey))
   .limit(200).map(e->byProduct.get(e.getKey())).toList();
  Set<String> semanticProductIds=semanticMap.keySet();
  List<String> ids=new ArrayList<>();
  for(int position=0;position<20&&ids.size()<300;position++){
   for(var p:products){
    var active=p.getSkus().stream().filter(s->s.statusEnum()==SkuStatusEnumVO.ACTIVE).toList();
    if(position<active.size())ids.add(active.get(position).id());
    if(ids.size()==300)break;
   }
  }
  List<SkuOfferVO> offers=catalog.offers(ids,true,false);Map<String,StockVO> stocks=inventory.stocks(ids).stream().collect(Collectors.toMap(StockVO::skuId,s->s));
  List<AiOfferVO> candidates=offers.stream().map(o->{StockVO stock=stocks.get(o.skuId());return new AiOfferVO(o.skuId(),o.merchantId(),o.title(),o.specKey(),o.description(),o.priceCent(),stock==null?0:stock.onHand()-stock.reserved());}).filter(o->o.available()>0).toList();
  List<String> semanticSkuIds=offers.stream().filter(o->semanticProductIds.contains(o.productId())).map(SkuOfferVO::skuId).toList();
  AiAnswerVO answer=engine.query(new AiQueryEntity(question,documents.stream().map(KnowledgeDocumentVO::id).toList(),candidates,history,recall.query(),semanticSkuIds));
  // 远程响应返回前重新校验整个知识授权快照，撤权/撤稿期间不输出已生成内容。
  var current=knowledge.readableDocuments(actor);require(fingerprint.equals(scope(current)),ResponseCode.KNOWLEDGE_NOT_READY);Map<String,KnowledgeDocumentVO> byId=current.stream().collect(Collectors.toMap(KnowledgeDocumentVO::id,d->d));
  List<AiCitationVO> citations=new ArrayList<>();for(var c:answer.citations()){var d=byId.get(c.documentId());require(d!=null&&c.snippet()!=null&&c.snippet().length()<=500&&d.content().contains(c.snippet()),ResponseCode.KNOWLEDGE_NOT_READY);citations.add(new AiCitationVO(d.id(),c.chunkId(),d.title(),"PUBLIC".equals(d.visibility())?c.snippet():"内部资料来源，原文片段不公开展示",c.score()));}
  Map<String,SkuOfferVO> allowed=offers.stream().collect(Collectors.toMap(SkuOfferVO::skuId,o->o));List<ProposalItemVO> items=new ArrayList<>();Set<String> seen=new HashSet<>();
  for(var recommendation:answer.recommendations()){
   var o=allowed.get(recommendation.skuId());if(o==null||!seen.add(o.skuId())||recommendation.quantity()<1||recommendation.quantity()>99)continue;
   var stock=stocks.get(o.skuId());if(stock==null||stock.onHand()-stock.reserved()<recommendation.quantity())continue;
   items.add(new ProposalItemVO(o.skuId(),o.merchantId(),o.title(),o.specKey(),o.priceCent(),o.version(),recommendation.quantity(),o.imageUrl()));if(items.size()==3)break;
  }
  ProposalVO proposal=items.isEmpty()?null:new ProposalVO(UUID.randomUUID().toString(),actor,conversation,ProposalStatusEnumVO.PENDING.name(),List.copyOf(items),null,clock.instant().plusSeconds(Math.max(1,Math.min(proposalMinutes,30))*60));
  // 不把模型提出但未通过 Java SKU/库存复核的条目输出给前端。
  Map<String,String> reasons=new HashMap<>();
  for(var r:answer.recommendations())if(r.skuId()!=null)reasons.putIfAbsent(r.skuId(),r.reason());
  List<AiRecommendationVO> verified=items.stream().map(i->{
   String reason=reasons.get(i.skuId());return new AiRecommendationVO(i.skuId(),i.quantity(),reason==null||reason.isBlank()?"匹配当前需求":reason);
  }).toList();
  AiAnswerVO safe=new AiAnswerVO(answer.answer(),answer.mode(),answer.retrievalMode(),answer.rewrittenQuery(),answer.warning(),List.copyOf(citations),verified,answer.latencyMs());
  conversations.appendTurn(actor,conversation,question,safe.answer(),proposal,fingerprint);return new ChatResult(conversation,safe,proposal);
 }
 private String scope(List<KnowledgeDocumentVO> docs){return Fingerprints.of(docs.stream().map(KnowledgeDocumentVO::id).sorted().toArray());}
 private List<MessageVO> safeHistory(String actor,String conversation,String fingerprint,int limit){return conversations.messages(actor,conversation,limit).stream().map(m->"assistant".equals(m.role())&&!fingerprint.equals(m.accessFingerprint())?new MessageVO(m.id(),m.conversationId(),m.role(),"资料权限或版本已变化，此历史回答已隐藏，请重新提问。",m.createdAt(),fingerprint):m).toList();}
 public List<MessageVO> history(String actor,String conversation){accounts.requireActive(actor);return safeHistory(actor,conversation,scope(knowledge.readableDocuments(actor)),100);}
 public List<ConversationVO> conversations(String actor){accounts.requireActive(actor);return conversations.conversations(actor);}
 public List<ProposalVO> proposals(String actor,String conversation){accounts.requireActive(actor);return proposals.proposals(actor,conversation);}
 @Transactional(rollbackFor=Exception.class)
 public ProposalVO confirm(String actor,String id,List<String> selected){
  accounts.requireActive(actor);require(selected!=null&&!selected.isEmpty()&&selected.size()<=20&&selected.stream().allMatch(Objects::nonNull),ResponseCode.ILLEGAL_PARAMETER);
  List<String> ids=selected.stream().distinct().sorted().toList();require(ids.size()==selected.size(),ResponseCode.ILLEGAL_PARAMETER);ProposalVO p=proposals.proposal(actor,id,true);
  Map<String,ProposalItemVO> proposed=p.items().stream().collect(Collectors.toMap(ProposalItemVO::skuId,i->i));require(ids.stream().allMatch(proposed::containsKey),ResponseCode.ILLEGAL_PARAMETER);String hash=Fingerprints.of(ids.toArray());
  ProposalAggregate aggregate=new ProposalAggregate(p.userId(),p.expiresAt(),p.status(),p.selectionHash());if(!aggregate.confirm(actor,hash,clock.instant()))return p;
  cart.lockCart(actor);ids.stream().map(s->proposed.get(s).merchantId()).distinct().sorted().forEach(merchants::requireActiveForNewTrade);
  var offers=catalog.offers(ids,true,true).stream().collect(Collectors.toMap(SkuOfferVO::skuId,o->o));var stocks=inventory.stocks(ids).stream().collect(Collectors.toMap(StockVO::skuId,s->s));
  for(String sku:ids){var item=proposed.get(sku);var o=offers.get(sku);require(o.priceCent()==item.priceCent()&&o.version()==item.quoteVersion()&&o.merchantId().equals(item.merchantId()),ResponseCode.PRICE_CHANGED);var stock=stocks.get(sku);require(stock!=null&&stock.onHand()-stock.reserved()>=item.quantity(),ResponseCode.STOCK_NOT_ENOUGH);cart.addCart(actor,o.merchantId(),sku,item.quantity());}
  proposals.confirm(id,hash);return proposals.proposal(actor,id,false);
 }
 public void reject(String actor,String proposal){accounts.requireActive(actor);proposals.reject(actor,proposal);}
}
