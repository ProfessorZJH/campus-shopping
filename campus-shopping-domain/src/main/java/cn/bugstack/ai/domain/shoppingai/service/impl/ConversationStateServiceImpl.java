package cn.bugstack.ai.domain.shoppingai.service.impl;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IProposalRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationStateService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 对话与消息领域服务。
 * 同一轮的用户消息、模型回答及可选提案必须原子提交，不能拆成三笔独立事务。
 * 本服务只通过本地 Repository 写事实，不直接调用大模型或向量库。
 */
@Service
public class ConversationStateServiceImpl implements IConversationStateService {
    private final IConversationRepository conversations;
    private final IProposalRepository proposals;
    private final Clock clock;

    public ConversationStateServiceImpl(IConversationRepository conversations,
                                        IProposalRepository proposals, Clock clock) {
        this.conversations = conversations;
        this.proposals = proposals;
        this.clock = clock;
    }

    @Override
    public ConversationVO conversation(String actor, String id, String question) {
        if (id == null || id.isBlank()) {
            String title = text(question, "问题", 2000);
            ConversationVO created = new ConversationVO(UUID.randomUUID().toString(), actor,
                    title.substring(0, Math.min(title.length(), 100)), clock.instant());
            conversations.createConversation(created);
            return created;
        }
        ConversationVO existing = conversations.conversation(id);
        require(existing != null && actor.equals(existing.userId()), ResponseCode.NOT_FOUND);
        return existing;
    }

    @Override
    public List<ConversationVO> conversations(String actor) {
        return conversations.conversations(actor);
    }

    @Override
    public List<MessageVO> messages(String actor, String conversation, int limit) {
        conversation(actor, conversation, "历史会话");
        require(limit > 0 && limit <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return conversations.messages(conversation, limit);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void appendTurn(String actor, String conversation, String question, String answer,
                           ProposalVO proposal, String accessFingerprint) {
        conversation(actor, conversation, question);
        conversations.append(new MessageVO(UUID.randomUUID().toString(), conversation, "user",
                text(question, "问题", 2000), clock.instant(), null));
        conversations.append(new MessageVO(UUID.randomUUID().toString(), conversation, "assistant",
                text(answer, "回答", 10000), clock.instant(), accessFingerprint));
        if (proposal != null) {
            proposals.insertProposal(proposal);
        }
    }
}
