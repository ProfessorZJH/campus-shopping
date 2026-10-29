package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class ConversationRepository implements IConversationRepository {

    @Resource
    private IAiDao dao;

    @Resource
    private ObjectMapper mapper;

    public void createConversation(ConversationVO c) {
        dao.conversationInsert(ConversationPO.builder().id(c.id()).userId(c.userId()).title(c.title()).createdAt(c.createdAt()).build());
    }

    public ConversationVO conversation(String id) {
        return conversation(dao.conversation(id));
    }

    public List<ConversationVO> conversations(String user) {
        return dao.conversations(user).stream().map(this::conversation).toList();
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

    public void insertProposal(ProposalVO p) {
        try {
            dao.proposalInsert(
                ProposalPO.builder()
                    .id(p.id())
                    .userId(p.userId())
                    .conversationId(p.conversationId())
                    .status(p.status())
                    .itemsJson(mapper.writeValueAsString(p.items()))
                    .selectionHash(p.selectionHash())
                    .expiresAt(p.expiresAt())
                    .build()
            );
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("提案序列化失败", e);
        }
    }

    private ConversationVO conversation(ConversationPO p) {
        return p == null ? null : new ConversationVO(p.getId(), p.getUserId(), p.getTitle(), p.getCreatedAt());
    }
}
