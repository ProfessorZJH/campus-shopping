package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IProposalRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.infrastructure.dao.IAiDao;
import cn.bugstack.ai.infrastructure.dao.po.ProposalPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.List;

import static cn.bugstack.ai.types.common.Checks.require;

/** 导购提案快照的本地存储；反序列化失败不能用空提案掩盖历史数据损坏。 */
@Repository
public class ProposalRepository implements IProposalRepository {
    @Resource private IAiDao dao;
    @Resource private ObjectMapper mapper;

    @Override
    public void insertProposal(ProposalVO proposal) {
        try {
            dao.proposalInsert(ProposalPO.builder().id(proposal.id())
                    .userId(proposal.userId()).conversationId(proposal.conversationId())
                    .status(proposal.status()).itemsJson(mapper.writeValueAsString(proposal.items()))
                    .selectionHash(proposal.selectionHash()).expiresAt(proposal.expiresAt()).build());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("提案序列化失败", e);
        }
    }

    @Override
    public ProposalVO proposal(String id, boolean lock) { return convert(dao.proposal(id, lock)); }

    @Override
    public void proposalState(String id, String status, String selectionHash) {
        require(dao.proposalState(id, status, selectionHash) == 1, ResponseCode.STATE_CONFLICT);
    }

    @Override
    public List<ProposalVO> proposals(String user, String conversation) {
        return dao.proposals(user, conversation).stream().map(this::convert).toList();
    }

    private ProposalVO convert(ProposalPO po) {
        if (po == null) {
            return null;
        }
        try {
            return new ProposalVO(po.getId(), po.getUserId(), po.getConversationId(),
                    po.getStatus(), mapper.readValue(po.getItemsJson(),
                            new TypeReference<List<ProposalItemVO>>() {}), po.getSelectionHash(),
                    po.getExpiresAt());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("提案数据损坏", e);
        }
    }
}
