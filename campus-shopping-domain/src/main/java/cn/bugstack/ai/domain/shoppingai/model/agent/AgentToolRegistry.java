package cn.bugstack.ai.domain.shoppingai.model.agent;

import java.util.Set;

/** 首期显式注册的工具集合；不接受模型提供的 URL、类名或动态函数。 */
public final class AgentToolRegistry {
    public static final String SEARCH_PRODUCTS = "search_products";
    public static final String VERSION = "1.0";
    public static final Set<String> READ_ONLY_TOOLS = Set.of(SEARCH_PRODUCTS);

    private AgentToolRegistry() {}

    public static boolean contains(String name) {
        return READ_ONLY_TOOLS.contains(name);
    }
}
