package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.ConversationPO;
import cn.bugstack.ai.infrastructure.dao.po.MessagePO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.List;

/** 对话与消息的本地 MySQL 映射，不直接调用 AI Engine。 */
@Repository
public class ConversationRepository implements IConversationRepository {
    @Resource private IAiDao dao;

    @Override
    public void createConversation(ConversationVO conversation) {
        dao.conversationInsert(ConversationPO.builder().id(conversation.id())
                .userId(conversation.userId()).title(conversation.title())
                .createdAt(conversation.createdAt()).build());
    }

    @Override
    public ConversationVO conversation(String id) { return convert(dao.conversation(id)); }

    @Override
    public List<ConversationVO> conversations(String user) {
        return dao.conversations(user).stream().map(this::convert).toList();
    }

    @Override
    public List<MessageVO> messages(String conversation, int limit) {
        return dao.messages(conversation, limit).stream()
                .map(po -> new MessageVO(po.getId(), po.getConversationId(), po.getRole(),
                        po.getContent(), po.getCreatedAt(), po.getAccessFingerprint())).toList();
    }

    @Override
    public void append(MessageVO message) {
        dao.messageInsert(MessagePO.builder().id(message.id())
                .conversationId(message.conversationId()).role(message.role())
                .content(message.content()).createdAt(message.createdAt())
                .accessFingerprint(message.accessFingerprint()).build());
    }

    private ConversationVO convert(ConversationPO po) {
        return po == null ? null : new ConversationVO(
                po.getId(), po.getUserId(), po.getTitle(), po.getCreatedAt());
    }
}
