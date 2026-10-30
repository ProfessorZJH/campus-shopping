package cn.bugstack.ai.cases.shoppingai;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.time.Instant;
import java.util.List;

/** 模型回答完成后的短事务提交能力。 */
public interface IConversationTurnCase {
    ProposalVO complete(ConversationTurnVO turn, String question, String answer, List<ProposalItemVO> items, Instant expiresAt, String fingerprint);
}
