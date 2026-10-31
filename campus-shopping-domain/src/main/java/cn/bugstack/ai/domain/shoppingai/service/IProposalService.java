package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IProposalService {
  ProposalVO proposal(String actor, String id);
  List<ProposalVO> proposals(String actor, String conversation);
  ProposalVO confirmSelection(String actor, String id, List<String> selected);
  void reject(String actor, String id);
}
