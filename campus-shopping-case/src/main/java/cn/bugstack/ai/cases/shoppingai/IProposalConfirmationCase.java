package cn.bugstack.ai.cases.shoppingai;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.List;

public interface IProposalConfirmationCase {
    ProposalVO confirm(String actor, String id, List<String> selected);
}
