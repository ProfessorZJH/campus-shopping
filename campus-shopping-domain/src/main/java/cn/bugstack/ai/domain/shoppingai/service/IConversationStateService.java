package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

/** 会话与消息的业务能力：用户归属复核，消息与同轮提案原子写入。 */
public interface IConversationStateService {
    ConversationVO conversation(String actor, String id, String question);
    List<ConversationVO> conversations(String actor);
    List<MessageVO> messages(String actor, String conversation, int limit);
    void appendTurn(String actor, String conversation, String question,
                    String answer, ProposalVO proposal, String accessFingerprint);
}
