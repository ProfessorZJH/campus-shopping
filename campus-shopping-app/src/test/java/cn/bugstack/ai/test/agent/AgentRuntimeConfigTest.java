package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertFalse;

import cn.bugstack.ai.cases.agent.impl.AgentRuntimeCaseImpl;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class AgentRuntimeConfigTest {
    @Test
    void runtimeCaseIsNotRegisteredWhenBridgeIsDisabledByDefault() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(AgentRuntimeCaseImpl.class);
            context.refresh();
            assertFalse(context.containsBean("agentRuntimeCaseImpl"));
        }
    }
}
