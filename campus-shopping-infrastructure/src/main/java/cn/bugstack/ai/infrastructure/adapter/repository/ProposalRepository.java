package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IProposalRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class ProposalRepository implements IProposalRepository {

    @Resource
    private IAiDao dao;

    @Resource
    private ObjectMapper mapper;

    public ProposalVO proposal(String id, boolean lock) {
        return proposal(dao.proposal(id, lock));
    }

    public void proposalState(String id, String status, String hash) {
        require(dao.proposalState(id, status, hash) == 1, ResponseCode.STATE_CONFLICT);
    }

    public List<ProposalVO> proposals(String user, String conversation) {
        return dao.proposals(user, conversation).stream().map(this::proposal).toList();
    }

    private ProposalVO proposal(ProposalPO p) {
        if (p == null) return null;
        try {
            return new ProposalVO(
                p.getId(),
                p.getUserId(),
                p.getConversationId(),
                p.getStatus(),
                mapper.readValue(p.getItemsJson(), new TypeReference<List<ProposalItemVO>>() {}),
                p.getSelectionHash(),
                p.getExpiresAt()
            );
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("提案数据损坏", e);
        }
    }
}
