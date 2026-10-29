package cn.bugstack.ai.domain.shoppingai.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IProposalRepository {
    ProposalVO proposal(String id, boolean lock);
    void proposalState(String id, String status, String selectionHash);
    List<ProposalVO> proposals(String user, String conversation);
}
