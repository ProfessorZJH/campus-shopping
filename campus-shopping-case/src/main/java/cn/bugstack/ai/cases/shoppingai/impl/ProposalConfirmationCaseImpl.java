package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.cases.shoppingai.IProposalConfirmationCase;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 同事务复验商品、价格、库存并幂等加购；与长耗时模型会话分开。 */
@Service
public class ProposalConfirmationCaseImpl implements IProposalConfirmationCase {

    private final IProposalService proposals;
    private final IUserAccountService accounts;
    private final ICartService trading;
    private final IMerchantService merchants;
    private final ICatalogService catalog;
    private final IInventoryService inventory;

    public ProposalConfirmationCaseImpl(
        IProposalService proposals,
        IUserAccountService accounts,
        ICartService trading,
        IMerchantService merchants,
        ICatalogService catalog,
        IInventoryService inventory
    ) {
        this.proposals = proposals;
        this.accounts = accounts;
        this.trading = trading;
        this.merchants = merchants;
        this.catalog = catalog;
        this.inventory = inventory;
    }

    @Transactional(rollbackFor = Exception.class)
    public ProposalVO confirm(String actor, String id, List<String> selected) {
        accounts.requireActive(actor);
        ProposalVO p = proposals.confirmSelection(actor, id, selected);
        if (p == null) return proposals.proposal(actor, id);
        List<String> ids = selected.stream().sorted().toList();
        Map<String, ProposalItemVO> proposed = p
            .items()
            .stream()
            .collect(Collectors.toMap(ProposalItemVO::skuId, i -> i));
        trading.lockCart(actor);
        ids.stream()
            .map(s -> proposed.get(s).merchantId())
            .distinct()
            .sorted()
            .forEach(merchants::requireActiveForNewTrade);
        var offers = catalog
            .saleOffersForUpdate(ids)
            .stream()
            .collect(Collectors.toMap(SkuOfferVO::skuId, o -> o));
        var stocks = inventory
            .stocks(ids)
            .stream()
            .collect(Collectors.toMap(StockVO::skuId, s -> s));
        for (String sku : ids) {
            var item = proposed.get(sku);
            var o = offers.get(sku);
            require(
                o.priceCent() == item.priceCent() && o.version() == item.quoteVersion() && o.merchantId().equals(item.merchantId()),
                ResponseCode.PRICE_CHANGED
            );
            var stock = stocks.get(sku);
            require(stock != null && stock.onHand() - stock.reserved() >= item.quantity(), ResponseCode.STOCK_NOT_ENOUGH);
            trading.addCart(actor, o.merchantId(), sku, item.quantity());
        }
        return proposals.proposal(actor, id);
    }
}
