package cn.bugstack.ai.domain.shoppingai.model.agent;

import java.util.Set;

/** 首期显式注册的工具集合；不接受模型提供的 URL、类名或动态函数。 */
public final class AgentToolRegistry {
    public static final String SEARCH_PRODUCTS = "search_products";
    public static final String KNOWLEDGE_QA = "knowledge_qa";
    public static final String GET_MY_ORDERS = "get_my_orders";
    public static final String VERSION = "1.0";
    /** M2 默认可执行集合；保持旧 Runtime 与旧导购兼容。 */
    public static final Set<String> READ_ONLY_TOOLS = Set.of(SEARCH_PRODUCTS);
    /** 已知的版本化只读契约；新工具仍需 feature gate 才能进入 Run。 */
    public static final Set<String> KNOWN_READ_ONLY_TOOLS = Set.of(SEARCH_PRODUCTS, KNOWLEDGE_QA, GET_MY_ORDERS);
    public static final Set<String> CONSUMER_READ_ONLY_TOOLS = Set.of(KNOWLEDGE_QA, GET_MY_ORDERS);

    private AgentToolRegistry() {}

    public static boolean contains(String name) {
        return KNOWN_READ_ONLY_TOOLS.contains(name);
    }

    public static boolean enabled(String name, boolean consumerReadOnlyEnabled) {
        return READ_ONLY_TOOLS.contains(name) || (consumerReadOnlyEnabled && CONSUMER_READ_ONLY_TOOLS.contains(name));
    }

    public static String version(String name) {
        return contains(name) ? VERSION : null;
    }
}
