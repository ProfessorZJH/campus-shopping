package cn.bugstack.ai.types.common;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** 安全诊断保留异常类型、因果链与代码位置，不输出可能含远程正文或凭据的异常消息。 */
public final class FailureDiagnostics {

    private FailureDiagnostics() {}

    public static String describe(Throwable failure) {
        StringBuilder result = new StringBuilder();
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (int depth = 0; failure != null && depth < 8 && seen.add(failure); depth++, failure = failure.getCause()) {
            if (depth > 0) result.append(" caused by ");
            result.append(failure.getClass().getName());
            StackTraceElement[] frames = failure.getStackTrace();
            for (int i = 0; i < Math.min(frames.length, 8); i++) result.append(" at ").append(frames[i]);
        }
        return result.toString();
    }
}
