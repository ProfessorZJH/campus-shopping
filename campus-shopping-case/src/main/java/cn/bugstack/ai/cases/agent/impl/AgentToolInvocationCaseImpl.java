package cn.bugstack.ai.cases.agent.impl;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.cases.agent.IAgentConsumerReadToolCase;
import cn.bugstack.ai.cases.agent.IAgentToolInvocationCase;
import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogCandidateQuery;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentProductCandidateVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentSkuFactVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolRegistry;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.SearchProductsRequestVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** M2 妫ｆ牗澹掗崣顏囶嚢瀹搞儱鍙块敍姘偓娆撯偓澶婂将閸ョ偛鎮楅悽?Java 闁插秵鏌婇弽鎼佺崣缂佸繗鎯€閻樿埖鈧降鈧焦濮ゆ禒宄版嫲鎼存挸鐡ㄩ妴?*/
@Service
public class AgentToolInvocationCaseImpl implements IAgentToolInvocationCase {

    private final IAgentRunRepository repository;
    private final AgentRunCaseImpl runs;
    private final ICatalogCandidateQuery catalog;
    private final IInventoryService inventory;
    private final IMerchantService merchants;
    private final IUserAccountService accounts;
    private final Clock clock;
    private final IAgentConsumerReadToolCase consumerReadTools;
    private final boolean consumerReadOnlyEnabled;

    public AgentToolInvocationCaseImpl(
        IAgentRunRepository repository,
        AgentRunCaseImpl runs,
        ICatalogCandidateQuery catalog,
        IInventoryService inventory,
        IMerchantService merchants,
        IUserAccountService accounts,
        Clock clock
    ) {
        this(repository, runs, catalog, inventory, merchants, accounts, clock, null, false);
    }

    @Autowired
    public AgentToolInvocationCaseImpl(
        IAgentRunRepository repository,
        AgentRunCaseImpl runs,
        ICatalogCandidateQuery catalog,
        IInventoryService inventory,
        IMerchantService merchants,
        IUserAccountService accounts,
        Clock clock,
        IAgentConsumerReadToolCase consumerReadTools,
        @Value("${campus.ai.agent-consumer-readonly.enabled:false}") boolean consumerReadOnlyEnabled
    ) {
        this.repository = repository;
        this.runs = runs;
        this.catalog = catalog;
        this.inventory = inventory;
        this.merchants = merchants;
        this.accounts = accounts;
        this.clock = clock;
        this.consumerReadTools = consumerReadTools;
        this.consumerReadOnlyEnabled = consumerReadOnlyEnabled;
    }

    @Override
    public AgentToolResultVO invoke(AgentToolInvocationCommand command) {
        require(command != null, ResponseCode.ILLEGAL_PARAMETER);
        String actor = text(command.actor(), "actor", 64);
        accounts.requireActive(actor);
        String runId = text(command.runId(), "Run", 64);
        String capabilityToken = text(command.capabilityToken(), "capability", 200);
        String invocationKey = text(command.invocationKey(), "invocationKey", 100);
        String toolName = text(command.toolName(), "tool", 64);
        require(AgentToolRegistry.contains(toolName), ResponseCode.ILLEGAL_PARAMETER);

        AgentRunVO run = runs.usable(actor, runId, capabilityToken);
        require(run.allowedTools().contains(toolName), ResponseCode.AUTH_FORBIDDEN);
        require(AgentToolRegistry.SEARCH_PRODUCTS.equals(toolName), ResponseCode.ILLEGAL_PARAMETER);

        SearchProductsRequestVO request = new SearchProductsRequestVO(command.query(), command.limit(), command.merchantId());
        String merchantId = run.scope().resolveMerchant(request.merchantId());
        SearchProductsRequestVO normalized = new SearchProductsRequestVO(request.query(), request.limit(), merchantId);
        String inputFingerprint = Fingerprints.of(toolName, AgentToolRegistry.VERSION, normalized.query(), normalized.limit(), merchantId);
        AgentToolInvocationVO existing = repository.invocation(run.id(), invocationKey);
        if (existing != null) {
            require(inputFingerprint.equals(existing.inputFingerprint()), ResponseCode.REQUEST_CONFLICT);
            if (existing.completed()) return existing.result().asSearchResult();
            throw new AppException(ResponseCode.STATE_CONFLICT);
        }

        AgentToolInvocationVO invocation = new AgentToolInvocationVO(
            UUID.randomUUID().toString(),
            run.id(),
            invocationKey,
            toolName,
            inputFingerprint,
            "RUNNING",
            (AgentToolResultVO) null,
            null,
            clock.instant(),
            null
        );
        require(repository.claimInvocation(invocation), ResponseCode.STATE_CONFLICT);
        try {
            AgentToolResultVO result = searchProducts(normalized);
            require(repository.completeInvocation(run.id(), invocationKey, inputFingerprint, result, clock.instant()), ResponseCode.STATE_CONFLICT);
            return result;
        } catch (AppException error) {
            repository.failInvocation(run.id(), invocationKey, inputFingerprint, error.getCode(), clock.instant());
            throw error;
        } catch (RuntimeException error) {
            repository.failInvocation(run.id(), invocationKey, inputFingerprint, ResponseCode.AI_UNAVAILABLE.getCode(), clock.instant());
            throw new AppException(ResponseCode.AI_UNAVAILABLE, error);
        }
    }

    @Override
    public AgentToolInvocationResultVO invokeResult(AgentToolInvocationCommand command) {
        require(command != null, ResponseCode.ILLEGAL_PARAMETER);
        if (AgentToolRegistry.SEARCH_PRODUCTS.equals(command.toolName())) return new AgentToolInvocationResultVO(invoke(command));
        String actor = text(command.actor(), "actor", 64);
        accounts.requireActive(actor);
        String runId = text(command.runId(), "Run", 64);
        String capabilityToken = text(command.capabilityToken(), "capability", 200);
        String invocationKey = text(command.invocationKey(), "invocationKey", 100);
        String toolName = text(command.toolName(), "tool", 64);
        require(AgentToolRegistry.contains(toolName), ResponseCode.ILLEGAL_PARAMETER);
        require(AgentToolRegistry.enabled(toolName, consumerReadOnlyEnabled), ResponseCode.ILLEGAL_PARAMETER);

        AgentRunVO run = runs.usable(actor, runId, capabilityToken);
        require(run.allowedTools().contains(toolName), ResponseCode.AUTH_FORBIDDEN);
        require(AgentScopeVO.CONSUMER.equals(run.scope().identityKind()), ResponseCode.AUTH_FORBIDDEN);
        String inputFingerprint = versionedFingerprint(toolName, command);
        AgentToolInvocationVO existing = repository.invocation(run.id(), invocationKey);
        if (existing != null) {
            require(inputFingerprint.equals(existing.inputFingerprint()), ResponseCode.REQUEST_CONFLICT);
            if (existing.completed()) return existing.result();
            throw new AppException(ResponseCode.STATE_CONFLICT);
        }
        AgentToolInvocationVO invocation = new AgentToolInvocationVO(
            UUID.randomUUID().toString(),
            run.id(),
            invocationKey,
            toolName,
            inputFingerprint,
            "RUNNING",
            (AgentToolInvocationResultVO) null,
            null,
            clock.instant(),
            null
        );
        require(repository.claimInvocation(invocation), ResponseCode.STATE_CONFLICT);
        try {
            AgentToolInvocationResultVO result = dispatchConsumer(run, command);
            require(repository.completeInvocationEnvelope(run.id(), invocationKey, inputFingerprint, result, clock.instant()), ResponseCode.STATE_CONFLICT);
            return result;
        } catch (AppException error) {
            repository.failInvocation(run.id(), invocationKey, inputFingerprint, error.getCode(), clock.instant());
            throw error;
        } catch (RuntimeException error) {
            repository.failInvocation(run.id(), invocationKey, inputFingerprint, ResponseCode.AI_UNAVAILABLE.getCode(), clock.instant());
            throw new AppException(ResponseCode.AI_UNAVAILABLE, error);
        }
    }

    private String versionedFingerprint(String toolName, AgentToolInvocationCommand command) {
        if (AgentToolRegistry.KNOWLEDGE_QA.equals(toolName)) {
            AgentKnowledgeQaRequestVO request = new AgentKnowledgeQaRequestVO(command.query());
            return Fingerprints.of(toolName, request.version(), request.question());
        }
        require(AgentToolRegistry.GET_MY_ORDERS.equals(toolName), ResponseCode.ILLEGAL_PARAMETER);
        AgentMyOrdersRequestVO request = new AgentMyOrdersRequestVO(command.state(), command.page(), command.size());
        return Fingerprints.of(toolName, request.version(), request.state(), request.page(), request.size());
    }

    private AgentToolInvocationResultVO dispatchConsumer(AgentRunVO run, AgentToolInvocationCommand command) {
        require(consumerReadTools != null, ResponseCode.AI_UNAVAILABLE);
        if (AgentToolRegistry.KNOWLEDGE_QA.equals(command.toolName())) {
            return AgentToolInvocationResultVO.knowledge(consumerReadTools.knowledgeQa(run.userId(), new AgentKnowledgeQaRequestVO(command.query())));
        }
        require(AgentToolRegistry.GET_MY_ORDERS.equals(command.toolName()), ResponseCode.ILLEGAL_PARAMETER);
        return AgentToolInvocationResultVO.orders(
            consumerReadTools.myOrders(run.userId(), new AgentMyOrdersRequestVO(command.state(), command.page(), command.size()))
        );
    }

    private AgentToolResultVO searchProducts(SearchProductsRequestVO request) {
        List<String> terms = terms(request.query());
        if (terms.isEmpty()) return new AgentToolResultVO(AgentToolRegistry.SEARCH_PRODUCTS, AgentToolRegistry.VERSION, true, List.of());

        int recallLimit = Math.min(200, Math.max(request.limit() * 10, request.limit()));
        List<ProductCandidateSnapshot> snapshots = catalog.candidateRecall(terms, recallLimit);
        if (snapshots.isEmpty()) return new AgentToolResultVO(AgentToolRegistry.SEARCH_PRODUCTS, AgentToolRegistry.VERSION, true, List.of());

        List<String> skuIds = snapshots
            .stream()
            .flatMap(snapshot -> snapshot.activeSkuIds().stream())
            .distinct()
            .limit(300)
            .toList();
        if (skuIds.isEmpty()) return new AgentToolResultVO(AgentToolRegistry.SEARCH_PRODUCTS, AgentToolRegistry.VERSION, true, List.of());

        Map<String, StockVO> stocks = inventory
            .stocks(skuIds)
            .stream()
            .collect(Collectors.toMap(StockVO::skuId, Function.identity(), (left, right) -> left));
        List<SkuOfferVO> offers = catalog.availableOffers(skuIds);
        Set<String> merchantIds = offers.stream().map(SkuOfferVO::merchantId).collect(Collectors.toSet());
        Map<String, MerchantVO> activeMerchants = merchants
            .findAll(List.copyOf(merchantIds))
            .stream()
            .filter(merchant -> "ACTIVE".equals(merchant.status()))
            .collect(Collectors.toMap(MerchantVO::id, Function.identity(), (left, right) -> left));

        Map<String, List<SkuOfferVO>> byProduct = new LinkedHashMap<>();
        for (SkuOfferVO offer : offers) {
            if (!activeMerchants.containsKey(offer.merchantId())) continue;
            if (request.merchantId() != null && !request.merchantId().equals(offer.merchantId())) continue;
            StockVO stock = stocks.get(offer.skuId());
            if (stock == null || stock.onHand() <= stock.reserved()) continue;
            if (!offer.merchantId().equals(stock.merchantId()) || !offer.storeId().equals(stock.storeId())) continue;
            byProduct.computeIfAbsent(offer.productId(), ignored -> new ArrayList<>()).add(offer);
        }

        Map<String, Integer> order = new LinkedHashMap<>();
        for (int i = 0; i < snapshots.size(); i++) order.putIfAbsent(snapshots.get(i).productId(), i);
        List<AgentProductCandidateVO> candidates = byProduct
            .entrySet()
            .stream()
            .sorted(Comparator.comparingInt(entry -> order.getOrDefault(entry.getKey(), Integer.MAX_VALUE)))
            .limit(request.limit())
            .map(entry -> candidate(entry.getKey(), entry.getValue(), stocks))
            .filter(java.util.Objects::nonNull)
            .toList();
        return new AgentToolResultVO(AgentToolRegistry.SEARCH_PRODUCTS, AgentToolRegistry.VERSION, true, candidates);
    }

    private AgentProductCandidateVO candidate(String productId, List<SkuOfferVO> offers, Map<String, StockVO> stocks) {
        if (offers.isEmpty()) return null;
        SkuOfferVO first = offers.get(0);
        List<AgentSkuFactVO> facts = offers
            .stream()
            .map(offer -> {
                StockVO stock = stocks.get(offer.skuId());
                long available = stock == null ? 0 : stock.onHand() - stock.reserved();
                return new AgentSkuFactVO(offer.skuId(), offer.specKey(), offer.priceCent(), offer.version(), available);
            })
            .toList();
        return new AgentProductCandidateVO(productId, first.merchantId(), first.storeId(), first.title(), "CATALOG_READ_MODEL", true, facts);
    }

    private List<String> terms(String query) {
        return Arrays.stream(query.split("[\\s,\\uFF0C\\u3002\\uFF1B;\\u3001]+"))
            .map(String::strip)
            .flatMap(this::chunks)
            .filter(term -> term.length() >= 2 && term.length() <= 20 && term.matches("[\\p{L}\\p{N}_-]+"))
            .distinct()
            .limit(8)
            .toList();
    }

    private java.util.stream.Stream<String> chunks(String value) {
        if (value.length() <= 20) return java.util.stream.Stream.of(value);
        List<String> chunks = new ArrayList<>();
        for (int from = 0; from < value.length(); from += 20) chunks.add(value.substring(from, Math.min(value.length(), from + 20)));
        return chunks.stream();
    }
}
