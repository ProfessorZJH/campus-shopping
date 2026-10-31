package cn.bugstack.ai.domain.shoppingai.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Conversation 领域能力；仓储仅维护对应业务事实。 */
@Service
public class ConversationServiceImpl implements IConversationService {

    private final IConversationRepository repository;
    private final Clock clock;

    public ConversationServiceImpl(IConversationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public ConversationVO conversation(String actor, String id, String question) {
        if (id == null || id.isBlank()) {
            String title = text(question, "问题", 2000);
            ConversationVO c = new ConversationVO(UUID.randomUUID().toString(), actor, title.substring(0, Math.min(title.length(), 100)), clock.instant());
            repository.createConversation(c);
            return c;
        }
        ConversationVO c = repository.conversation(id);
        require(c != null && actor.equals(c.userId()), ResponseCode.NOT_FOUND);
        return c;
    }

    public List<ConversationVO> conversations(String actor, int page, int size) {
        return repository.conversations(actor, cn.bugstack.ai.types.common.Checks.offset(page, size), size);
    }

    public List<MessageVO> messages(String actor, String id, int limit) {
        conversation(actor, id, "历史会话");
        require(limit > 0 && limit <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return repository.messages(id, limit);
    }

    /** 租约通过单次 UPDATE 生效；远程模型调用期间没有数据库事务或行锁。 */
    public ConversationTurnVO beginTurn(String actor, String id, String question) {
        var conversation = conversation(actor, id, question);
        String token = UUID.randomUUID().toString();
        require(repository.claimTurn(conversation.id(), actor, token), ResponseCode.STATE_CONFLICT);
        return new ConversationTurnVO(conversation.id(), actor, token);
    }

    /** 必须与提案创建同事务提交；过期或被新请求替换的令牌不能写入消息。 */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void appendTurn(ConversationTurnVO turn, String question, String answer, String accessFingerprint) {
        require(repository.finishTurn(turn), ResponseCode.STATE_CONFLICT);
        repository.append(new MessageVO(UUID.randomUUID().toString(), turn.conversationId(), "user", text(question, "问题", 2000), clock.instant(), null));
        repository.append(
            new MessageVO(UUID.randomUUID().toString(), turn.conversationId(), "assistant", text(answer, "回答", 10000), clock.instant(), accessFingerprint)
        );
    }

    public void releaseTurn(ConversationTurnVO turn) {
        repository.releaseTurn(turn);
    }
}
