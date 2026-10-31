package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import java.util.List;

/** 按业务能力限定的领域端口。 */
public interface IConversationRepository {
    void createConversation(ConversationVO conversation);
    ConversationVO conversation(String id);
    List<ConversationVO> conversations(String user, int offset, int size);
    List<MessageVO> messages(String conversation, int limit);
    void append(MessageVO message);
    boolean claimTurn(String id, String actor, String token);
    boolean finishTurn(ConversationTurnVO turn);
    void releaseTurn(ConversationTurnVO turn);
}
