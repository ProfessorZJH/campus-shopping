package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.ConversationPO;
import cn.bugstack.ai.infrastructure.dao.po.DocumentRootPO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeBasePO;
import cn.bugstack.ai.infrastructure.dao.po.KnowledgeDocumentPO;
import cn.bugstack.ai.infrastructure.dao.po.MessagePO;
import cn.bugstack.ai.infrastructure.dao.po.ProposalPO;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IAiDao {
    int reserveBaseQuota();
    int baseInsert(@Param("p") KnowledgeBasePO p, @Param("creator") String creator);
    List<KnowledgeBasePO> bases();
    KnowledgeBasePO base(@Param("id") String id);
    int rootInsert(@Param("id") String id, @Param("base") String base);
    DocumentRootPO root(@Param("id") String id);
    int incrementVersion(@Param("id") String id);
    int documentInsert(@Param("p") KnowledgeDocumentPO p);
    KnowledgeDocumentPO document(@Param("id") String id);
    List<KnowledgeDocumentPO> documents(@Param("base") String base, @Param("offset") int offset, @Param("limit") int limit);
    long countDocuments(@Param("base") String base);
    List<KnowledgeDocumentPO> visibleScope(@Param("baseIds") List<String> baseIds);
    List<KnowledgeDocumentPO> documentsByIds(@Param("ids") List<String> ids);
    int beginIndex(@Param("id") String id, @Param("attempt") String attempt);
    int completeIndex(@Param("id") String id, @Param("attempt") String attempt, @Param("status") String status, @Param("error") String error);
    int documentState(@Param("id") String id, @Param("status") String status);
    int activeDocument(@Param("root") String root, @Param("id") String id);
    int conversationInsert(@Param("p") ConversationPO p);
    ConversationPO conversation(@Param("id") String id);
    List<ConversationPO> conversations(@Param("user") String user, @Param("offset") int offset, @Param("size") int size);
    List<MessagePO> messages(@Param("conversation") String conversation, @Param("limit") int limit);
    int claimTurn(@Param("id") String id, @Param("actor") String actor, @Param("token") String token);
    int finishTurn(@Param("id") String id, @Param("actor") String actor, @Param("token") String token);
    int releaseTurn(@Param("id") String id, @Param("actor") String actor, @Param("token") String token);
    int messageInsert(@Param("p") MessagePO p);
    int proposalInsert(@Param("p") ProposalPO p);
    ProposalPO proposal(@Param("id") String id, @Param("lock") boolean lock);
    int proposalState(@Param("id") String id, @Param("status") String status, @Param("selectionHash") String selectionHash);
    List<ProposalPO> proposals(@Param("user") String user, @Param("conversation") String conversation);
}
