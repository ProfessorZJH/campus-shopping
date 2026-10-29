package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import java.util.List;

/** 本地会话与消息持久化，按真实用户主体隔离访问。 */
public interface IConversationRepository {
    void createConversation(ConversationVO conversation);
    ConversationVO conversation(String id);
    List<ConversationVO> conversations(String user);
    List<MessageVO> messages(String conversation, int limit);
    void append(MessageVO message);
}
