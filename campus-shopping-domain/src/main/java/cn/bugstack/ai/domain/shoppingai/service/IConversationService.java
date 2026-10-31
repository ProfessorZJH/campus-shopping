package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IConversationService {
    ConversationVO conversation(String actor, String id, String question);
    List<ConversationVO> conversations(String actor, int page, int size);
    List<MessageVO> messages(String actor, String conversation, int limit);
    ConversationTurnVO beginTurn(String actor, String conversation, String question);
    void appendTurn(ConversationTurnVO turn, String question, String answer, String accessFingerprint);
    void releaseTurn(ConversationTurnVO turn);
}
