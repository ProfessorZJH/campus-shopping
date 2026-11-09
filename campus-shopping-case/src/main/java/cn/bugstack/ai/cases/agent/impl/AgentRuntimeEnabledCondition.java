package cn.bugstack.ai.cases.agent.impl;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/** Runtime bridge 默认关闭；Case 与 Infrastructure 使用同一显式开关，避免缺失 Port 导致启动失败。 */
public final class AgentRuntimeEnabledCondition implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return context.getEnvironment().getProperty("campus.ai.agent-runtime.enabled", Boolean.class, false);
    }
}
