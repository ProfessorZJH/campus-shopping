package cn.bugstack.ai.domain.shoppingai.service.impl;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiRepository;import cn.bugstack.ai.domain.shoppingai.service.IAiStateService;import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.types.enums.ResponseCode;import static cn.bugstack.ai.types.common.Checks.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import java.util.*;import java.time.*;
/** 状态规则与私有会话归属检查；远程索引调用不在这些事务中执行。 */
@Service
public class AiStateServiceImpl implements IAiStateService {
 private final IAiRepository repository;private final Clock clock;
 public AiStateServiceImpl(IAiRepository repository,Clock clock){this.repository=repository;this.clock=clock;}
 public KnowledgeBaseVO createBase(String name,String merchant,String visibility,String actor){
  require(merchant==null?Set.of("PUBLIC","PLATFORM_INTERNAL").contains(visibility):Set.of("PUBLIC","MERCHANT_INTERNAL").contains(visibility),ResponseCode.ILLEGAL_PARAMETER);
  KnowledgeBaseVO b=new KnowledgeBaseVO(UUID.randomUUID().toString(),text(name,"知识库名称",100),merchant,visibility);repository.createBase(b,actor);return b;
 }
 public List<KnowledgeBaseVO> bases(){return repository.bases();}
 public KnowledgeBaseVO base(String id){var b=repository.base(id);require(b!=null,ResponseCode.NOT_FOUND);return b;}
 @Transactional(rollbackFor=Exception.class)
 public KnowledgeDocumentVO createDocument(String root,String base,String title,String content){base(base);return repository.createDocument(UUID.randomUUID().toString(),root,base,text(title,"文档标题",120),text(content,"文档正文",100000));}
 public KnowledgeDocumentVO document(String id){var d=repository.document(id);require(d!=null,ResponseCode.NOT_FOUND);return d;}
 public List<KnowledgeDocumentVO> documents(String base,int page,int size){return repository.documents(base,offset(page,size),size);}
 public long countDocuments(String base){return repository.countDocuments(base);}
 public List<KnowledgeDocumentVO> visible(List<String> bases){require(bases.size()<=1000,ResponseCode.ILLEGAL_PARAMETER);return repository.visible(bases);}
 public void indexState(String id,String status,String error){require(Set.of("PENDING","READY","FAILED").contains(status),ResponseCode.ILLEGAL_PARAMETER);repository.indexState(id,status,optional(error,500));}
 @Transactional(rollbackFor=Exception.class)public void publish(String id){repository.publish(id);}
 @Transactional(rollbackFor=Exception.class)public void withdraw(String id){repository.withdraw(id);}
 public ConversationVO conversation(String actor,String id,String question){
  if(id==null||id.isBlank()){String title=text(question,"问题",2000);ConversationVO c=new ConversationVO(UUID.randomUUID().toString(),actor,title.substring(0,Math.min(title.length(),100)),clock.instant());repository.createConversation(c);return c;}
  ConversationVO c=repository.conversation(id);require(c!=null&&actor.equals(c.userId()),ResponseCode.NOT_FOUND);return c;
 }
 public List<ConversationVO> conversations(String actor){return repository.conversations(actor);}
 public List<MessageVO> messages(String actor,String id,int limit){conversation(actor,id,"历史会话");require(limit>0&&limit<=100,ResponseCode.ILLEGAL_PARAMETER);return repository.messages(id,limit);}
 @Transactional(rollbackFor=Exception.class)
 public void appendTurn(String actor,String conversation,String question,String answer,ProposalVO proposal,String accessFingerprint){
  conversation(actor,conversation,question);repository.append(new MessageVO(UUID.randomUUID().toString(),conversation,"user",text(question,"问题",2000),clock.instant(),null));
  repository.append(new MessageVO(UUID.randomUUID().toString(),conversation,"assistant",text(answer,"回答",10000),clock.instant(),accessFingerprint));if(proposal!=null)repository.insertProposal(proposal);
 }
 public ProposalVO proposal(String actor,String id,boolean lock){ProposalVO p=repository.proposal(id,lock);require(p!=null&&actor.equals(p.userId()),ResponseCode.NOT_FOUND);return p;}
 public List<ProposalVO> proposals(String actor,String conversation){conversation(actor,conversation,"历史会话");return repository.proposals(actor,conversation);}
 public void confirm(String id,String hash){repository.proposalState(id,"CONFIRMED",hash);}
 @Transactional(rollbackFor=Exception.class)
 public void reject(String actor,String id){ProposalVO p=proposal(actor,id,true);if("REJECTED".equals(p.status()))return;ProposalAggregate aggregate=new ProposalAggregate(p.userId(),p.expiresAt(),p.status(),p.selectionHash());aggregate.reject(actor);repository.proposalState(id,aggregate.getStatus(),null);}
}
