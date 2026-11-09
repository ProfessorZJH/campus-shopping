package cn.bugstack.ai.cases.agent.impl;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.cases.agent.IAgentRunCase;
import cn.bugstack.ai.cases.agent.model.AgentRunReceipt;
import cn.bugstack.ai.cases.agent.model.CreateAgentRunCommand;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolRegistry;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 受控 Run 生命周期；只依赖现有会话租约和身份/权限领域能力。 */
@Service
public class AgentRunCaseImpl implements IAgentRunCase {
    private final IAgentRunRepository repository;
    private final IUserAccountService accounts;
    private final IAccessService access;
    private final Clock clock;
    private final boolean consumerReadOnlyEnabled;

    public AgentRunCaseImpl(
        IAgentRunRepository repository,
        IUserAccountService accounts,
        IAccessService access,
        Clock clock
    ) {
        this(repository, accounts, access, clock, false);
    }

    @Autowired
    public AgentRunCaseImpl(
        IAgentRunRepository repository,
        IUserAccountService accounts,
        IAccessService access,
        Clock clock,
        @Value("${campus.ai.agent-consumer-readonly.enabled:false}") boolean consumerReadOnlyEnabled
    ) {
        this.repository = repository;
        this.accounts = accounts;
        this.access = access;
        this.clock = clock;
        this.consumerReadOnlyEnabled = consumerReadOnlyEnabled;
    }

    @Override
    @Transactional
    public AgentRunReceipt create(CreateAgentRunCommand command) {
        require(command != null, ResponseCode.ILLEGAL_PARAMETER);
        String actor = text(command.actor(), "用户", 64);
        accounts.requireActive(actor);
        String conversationId = text(command.conversationId(), "会话", 64);
        String turnToken = text(command.turnToken(), "会话租约", 64);
        String idempotencyKey = text(command.idempotencyKey(), "幂等键", 100);
        Set<String> allowedTools = command.allowedTools();
        require(!allowedTools.isEmpty() && allowedTools.stream().allMatch(tool -> AgentToolRegistry.enabled(tool, consumerReadOnlyEnabled)), ResponseCode.ILLEGAL_PARAMETER);
        Instant turnExpiresAt = repository.activeTurnExpiry(actor, conversationId, turnToken);
        require(turnExpiresAt != null && turnExpiresAt.isAfter(clock.instant()), ResponseCode.STATE_CONFLICT);
        AgentScopeVO scope = buildScope(actor, conversationId, turnToken, turnExpiresAt, command.merchantId());
        if (allowedTools.stream().anyMatch(AgentToolRegistry.CONSUMER_READ_ONLY_TOOLS::contains)) {
            require(AgentScopeVO.CONSUMER.equals(scope.identityKind()), ResponseCode.AUTH_FORBIDDEN);
        }
        AgentRunVO existing = repository.findByIdempotency(actor, idempotencyKey);
        if (existing != null) {
            require(existing.scope().equals(scope) && existing.allowedTools().equals(allowedTools), ResponseCode.REQUEST_CONFLICT);
            return receipt(existing, null);
        }
        String runId = UUID.randomUUID().toString();
        String capabilityToken = UUID.randomUUID().toString();
        Instant now = clock.instant();
        AgentRunVO run = new AgentRunVO(
            runId,
            actor,
            idempotencyKey,
            Fingerprints.sha256(capabilityToken),
            scope,
            allowedTools,
            AgentRunStatusVO.CREATED,
            now,
            now,
            0
        );
        if (repository.insert(run)) return receipt(run, capabilityToken);
        AgentRunVO raced = repository.findByIdempotency(actor, idempotencyKey);
        require(raced != null, ResponseCode.STATE_CONFLICT);
        require(raced.scope().equals(scope) && raced.allowedTools().equals(allowedTools), ResponseCode.REQUEST_CONFLICT);
        return receipt(raced, null);
    }

    @Override
    @Transactional
    public AgentRunReceipt start(String actor, String runId, String capabilityToken) {
        AgentRunVO run = usable(actor, runId, capabilityToken);
        AgentRunVO started = run.status() == AgentRunStatusVO.RUNNING ? run : run.running(clock.instant());
        if (started != run) require(repository.update(run, started), ResponseCode.STATE_CONFLICT);
        return receipt(started, null);
    }

    @Override
    @Transactional
    public AgentRunReceipt complete(String actor, String runId, String capabilityToken) {
        AgentRunVO run = usable(actor, runId, capabilityToken);
        require(run.status() == AgentRunStatusVO.RUNNING, ResponseCode.STATE_CONFLICT);
        AgentRunVO completed = run.completed(clock.instant());
        require(repository.update(run, completed), ResponseCode.STATE_CONFLICT);
        return receipt(completed, null);
    }

    @Override
    @Transactional
    public AgentRunReceipt fail(String actor, String runId, String capabilityToken) {
        AgentRunVO run = usable(actor, runId, capabilityToken);
        require(run.status() == AgentRunStatusVO.RUNNING, ResponseCode.STATE_CONFLICT);
        AgentRunVO failed = run.failed(clock.instant());
        require(repository.update(run, failed), ResponseCode.STATE_CONFLICT);
        return receipt(failed, null);
    }

    AgentRunVO usable(String actor, String runId, String capabilityToken) {
        String user = text(actor, "用户", 64);
        accounts.requireActive(user);
        AgentRunVO run = repository.find(text(runId, "Run", 64));
        require(run != null && user.equals(run.userId()), ResponseCode.NOT_FOUND);
        require(capabilityToken != null && Fingerprints.sha256(capabilityToken).equals(run.capabilityTokenHash()), ResponseCode.AUTH_FORBIDDEN);
        require(run.usable(clock), ResponseCode.STATE_CONFLICT);
        Instant activeExpiry = repository.activeTurnExpiry(user, run.scope().conversationId(), run.scope().turnToken());
        require(activeExpiry != null && activeExpiry.isAfter(clock.instant()), ResponseCode.STATE_CONFLICT);
        return run;
    }

    private AgentScopeVO buildScope(String actor, String conversationId, String token, Instant expiresAt, String requestedMerchant) {
        var memberships = access.memberships(actor).stream().filter(m -> "ACTIVE".equals(m.status())).toList();
        if (requestedMerchant == null) {
            return new AgentScopeVO(
                actor,
                AgentScopeVO.CONSUMER,
                null,
                memberships.stream().map(MembershipVO::merchantId).collect(Collectors.toUnmodifiableSet()),
                Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
                conversationId,
                token,
                expiresAt
            );
        }
        access.requirePermission(actor, requestedMerchant, "product.read");
        Set<String> merchantIds = memberships.stream().map(MembershipVO::merchantId).collect(Collectors.toUnmodifiableSet());
        require(merchantIds.contains(requestedMerchant), ResponseCode.AUTH_FORBIDDEN);
        return new AgentScopeVO(
            actor,
            AgentScopeVO.MERCHANT,
            requestedMerchant,
            merchantIds,
            Set.of("product.read", AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            conversationId,
            token,
            expiresAt
        );
    }

    private AgentRunReceipt receipt(AgentRunVO run, String capabilityToken) {
        return new AgentRunReceipt(run.id(), capabilityToken, run.scope().conversationId(), run.userId(), run.status(), run.scope().turnExpiresAt());
    }
}
