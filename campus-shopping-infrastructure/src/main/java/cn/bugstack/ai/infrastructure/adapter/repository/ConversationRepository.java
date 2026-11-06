package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.ConversationPO;
import cn.bugstack.ai.infrastructure.dao.po.MessageCitationPO;
import cn.bugstack.ai.infrastructure.dao.po.MessagePO;
import jakarta.annotation.Resource;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class ConversationRepository implements IConversationRepository {

    @Resource
    private IAiDao dao;

    public void createConversation(ConversationVO c) {
        dao.conversationInsert(
            ConversationPO.builder()
                .id(c.id())
                .userId(c.userId())
                .title(c.title())
                .createdAt(c.createdAt())
                .lastActiveAt(c.lastActiveAt())
                .summary(c.summary())
                .build()
        );
    }

    public ConversationVO conversation(String id) {
        return conversation(dao.conversation(id));
    }

    public List<ConversationVO> conversations(String user, int offset, int size) {
        return dao.conversations(user, offset, size).stream().map(this::conversation).toList();
    }

    public List<MessageVO> messages(String id, int limit) {
        List<MessagePO> rows = dao.messages(id, limit);
        if (rows.isEmpty()) return List.of();
        Map<String, List<AiCitationVO>> citations = new HashMap<>();
        dao.messageCitations(rows.stream().map(MessagePO::getId).toList()).forEach(p ->
            citations
                .computeIfAbsent(p.getMessageId(), ignored -> new ArrayList<>())
                .add(new AiCitationVO(p.getDocumentId(), p.getChunkId(), p.getTitle(), p.getSnippet(), 0, p.getRootId(), p.getDocumentVersion()))
        );
        return rows
            .stream()
            .map(p ->
                new MessageVO(
                    p.getId(),
                    p.getConversationId(),
                    p.getRole(),
                    p.getContent(),
                    p.getCreatedAt(),
                    p.getAccessFingerprint(),
                    citations.getOrDefault(p.getId(), List.of()),
                    p.isCitationsRecorded()
                )
            )
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
                .citationsRecorded(m.citationsRecorded())
                .build()
        );
        if (!m.citations().isEmpty()) {
            dao.messageCitationsInsert(
                IntStream.range(0, m.citations().size())
                    .mapToObj(ordinal -> {
                        var c = m.citations().get(ordinal);
                        return MessageCitationPO.builder()
                            .messageId(m.id())
                            .ordinal(ordinal)
                            .documentId(c.documentId())
                            .rootId(c.rootId())
                            .documentVersion(c.documentVersion())
                            .chunkId(c.chunkId())
                            .title(c.title())
                            .snippet(c.snippet())
                            .build();
                    })
                    .toList()
            );
        }
    }

    public boolean updateActivity(String id, String actor, Instant lastActiveAt, String summary) {
        return dao.conversationActivity(id, actor, lastActiveAt, summary) == 1;
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
        return p == null ? null : new ConversationVO(p.getId(), p.getUserId(), p.getTitle(), p.getCreatedAt(), p.getLastActiveAt(), p.getSummary());
    }
}
