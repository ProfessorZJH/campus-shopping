package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeSignature;
import org.junit.jupiter.api.Test;

class AgentRuntimeSignatureTest {
    @Test
    void signsCanonicalRunRequestAndRejectsTampering() {
        String signature = AgentRuntimeSignature.hmacSha256("service-key-for-test-only-123456", "run-1", "request-1", 1794272400.0);
        assertTrue(AgentRuntimeSignature.constantTimeEquals(signature, signature));
        assertFalse(AgentRuntimeSignature.constantTimeEquals(signature, signature.substring(0, signature.length() - 1) + "0"));
        assertNotEquals(signature, AgentRuntimeSignature.hmacSha256("service-key-for-test-only-123456", "run-2", "request-1", 1794272400.0));
    }
}
