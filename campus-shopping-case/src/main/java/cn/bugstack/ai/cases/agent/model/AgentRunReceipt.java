package cn.bugstack.ai.cases.agent.model;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import java.time.Instant;

public record AgentRunReceipt(String runId, String capabilityToken, String conversationId, String userId, AgentRunStatusVO status, Instant turnExpiresAt) {}
