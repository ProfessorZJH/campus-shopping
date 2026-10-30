package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.ConversationPO;
import cn.bugstack.ai.infrastructure.dao.po.MessagePO;
import jakarta.annotation.Resource;
import java.util.List;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class ConversationRepository implements IConversationRepository {

    @Resource
    private IAiDao dao;

    public void createConversation(ConversationVO c) {
        dao.conversationInsert(ConversationPO.builder().id(c.id()).userId(c.userId()).title(c.title()).createdAt(c.createdAt()).build());
    }

    public ConversationVO conversation(String id) {
        return conversation(dao.conversation(id));
    }

    public List<ConversationVO> conversations(String user, int offset, int size) {
        return dao.conversations(user, offset, size).stream().map(this::conversation).toList();
    }

    public List<MessageVO> messages(String id, int limit) {
        return dao
            .messages(id, limit)
            .stream()
            .map(p -> new MessageVO(p.getId(), p.getConversationId(), p.getRole(), p.getContent(), p.getCreatedAt(), p.getAccessFingerprint()))
            .toList();
    }

    public void append(MessageVO m) {
        dao.messageInsert(
            MessagePO.builder()
                .id(m.id())
                .conversationId(m.conversationId())
                .role(m.role())
                .content(m.content())
                .createdAt(m.createdAt())
                .accessFingerprint(m.accessFingerprint())
                .build()
        );
    }

    public boolean claimTurn(String id, String actor, String token) {
        return dao.claimTurn(id, actor, token) == 1;
    }

    public boolean finishTurn(ConversationTurnVO turn) {
        return dao.finishTurn(turn.conversationId(), turn.userId(), turn.token()) == 1;
    }

    public void releaseTurn(ConversationTurnVO turn) {
        dao.releaseTurn(turn.conversationId(), turn.userId(), turn.token());
    }

    private ConversationVO conversation(ConversationPO p) {
        return p == null ? null : new ConversationVO(p.getId(), p.getUserId(), p.getTitle(), p.getCreatedAt());
    }
}
