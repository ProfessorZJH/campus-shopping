package cn.bugstack.ai.cases.shoppingai.impl;
import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeStateService;import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.identity.service.*;import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.exception.AppException;import static cn.bugstack.ai.types.common.Checks.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import java.util.*;import java.util.stream.Collectors;
/** 知识发布指针是权限事实，Qdrant 里的旧向量不决定可见性。 */
@Service
public class KnowledgeCaseImpl implements IKnowledgeCase {
 private final IKnowledgeStateService state;private final IAiEnginePort engine;private final IAccessService access;private final IUserAccountService accounts;private final IMerchantService merchants;
 public KnowledgeCaseImpl(IKnowledgeStateService state,IAiEnginePort engine,IAccessService access,IUserAccountService accounts,IMerchantService merchants){this.state=state;this.engine=engine;this.access=access;this.accounts=accounts;this.merchants=merchants;}
 private KnowledgeBaseVO manage(String actor,String id,String permission){accounts.requireActive(actor);KnowledgeBaseVO b=state.base(id);if(access.isAdmin(actor))return b;require(b.merchantId()!=null,ResponseCode.AUTH_FORBIDDEN);access.requirePermission(actor,b.merchantId(),permission);return b;}
 public List<KnowledgeBaseVO> managedBases(String actor){accounts.requireActive(actor);boolean admin=access.isAdmin(actor);Set<String> managed=access.memberships(actor).stream().map(m->m.merchantId()).filter(id->access.permissions(actor,id).contains("knowledge.read")).collect(Collectors.toSet());return state.bases().stream().filter(b->admin||managed.contains(b.merchantId())).toList();}
 @Transactional(rollbackFor=Exception.class)
 public KnowledgeBaseVO createBase(String actor,String merchant,String name,String visibility){
  accounts.requireActive(actor);require(state.bases().size()<1000,ResponseCode.ILLEGAL_PARAMETER);
  if(merchant==null||merchant.isBlank()){access.requireAdmin(actor);merchant=null;}else{access.requirePermission(actor,merchant,"knowledge.manage");merchants.find(merchant);}
  KnowledgeBaseVO b=state.createBase(name,merchant,visibility,actor);access.audit(actor,"KNOWLEDGE_BASE_CREATED",b.id(),merchant,"创建知识库");return b;
 }
 public List<KnowledgeDocumentVO> documents(String actor,String base,int page,int size){manage(actor,base,"knowledge.read");return state.documents(base,page,size);}
 public long countDocuments(String actor,String base){manage(actor,base,"knowledge.read");return state.countDocuments(base);}
 public KnowledgeDocumentVO document(String actor,String id){var d=state.document(id);manage(actor,d.baseId(),"knowledge.read");return d;}
 /** 提取和建索引发生在数据库短事务之外，不持锁等待模型/向量库。 */
 public KnowledgeDocumentVO upload(String actor,String base,String root,String title,String filename,String mime,byte[] bytes){
  manage(actor,base,"knowledge.manage");require(bytes!=null&&bytes.length>0&&bytes.length<=2000000,ResponseCode.UPLOAD_INVALID);
  String content=engine.extract(text(filename,"文件名",120),optional(mime,100),bytes);manage(actor,base,"knowledge.manage");
  var d=state.createDocument(root==null||root.isBlank()?null:root,base,title,content);return index(actor,d.id());
 }
 public KnowledgeDocumentVO index(String actor,String id){
  var d=document(actor,id);manage(actor,d.baseId(),"knowledge.manage");state.indexState(id,"PENDING","");
  try{engine.index(id,d.title(),d.content());state.indexState(id,"READY","");}
  catch(Exception e){state.indexState(id,"FAILED","索引构建失败，可检查服务配置后重试");}
  return state.document(id);
 }
 @Transactional(rollbackFor=Exception.class)
 public void publish(String actor,String id){var d=document(actor,id);manage(actor,d.baseId(),"knowledge.manage");require("READY".equals(d.indexStatus()),ResponseCode.KNOWLEDGE_NOT_READY);state.publish(id);access.audit(actor,"KNOWLEDGE_PUBLISHED",id,d.merchantId(),"发布生效知识版本");}
 @Transactional(rollbackFor=Exception.class)
 public void withdraw(String actor,String id){var d=document(actor,id);manage(actor,d.baseId(),"knowledge.manage");state.withdraw(id);access.audit(actor,"KNOWLEDGE_WITHDRAWN",id,d.merchantId(),"撤回知识版本，后续检索立即排除");}
 public List<KnowledgeDocumentVO> readableDocuments(String actor){
  accounts.requireActive(actor);boolean admin=access.isAdmin(actor);Set<String> member=access.memberships(actor).stream().map(m->m.merchantId()).filter(id->access.permissions(actor,id).contains("knowledge.read")).collect(Collectors.toSet());Map<String,Boolean> active=new HashMap<>();List<String> allowed=new ArrayList<>();
  for(KnowledgeBaseVO b:state.bases()){
   boolean readable=switch(b.visibility()){
    case "PUBLIC" -> b.merchantId()==null||active.computeIfAbsent(b.merchantId(),m->"ACTIVE".equals(merchants.find(m).status()));
    case "MERCHANT_INTERNAL" -> member.contains(b.merchantId());
    case "PLATFORM_INTERNAL" -> admin;
    default -> false;
   };if(readable)allowed.add(b.id());
  }
  return state.visible(allowed);
 }
}
