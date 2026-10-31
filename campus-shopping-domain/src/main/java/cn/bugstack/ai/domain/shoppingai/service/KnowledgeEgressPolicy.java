package cn.bugstack.ai.domain.shoppingai.service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 内部知识默认不外发；商户及具体知识库须同时显式列入服务端批准配置。 */
@Component
public class KnowledgeEgressPolicy {

    private final Set<String> bases;
    private final Set<String> merchants;

    public KnowledgeEgressPolicy(@Value("${campus.ai.egress.base-ids:}") String bases, @Value("${campus.ai.egress.merchant-ids:}") String merchants) {
        this.bases = values(bases);
        this.merchants = values(merchants);
    }

    private Set<String> values(String value) {
        return Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
    }

    public boolean allows(String visibility, String base, String merchant) {
        return (
            "PUBLIC".equals(visibility) ||
            (base != null &&
                bases.contains(base) &&
                (("PLATFORM_INTERNAL".equals(visibility) && merchant == null) ||
                    ("MERCHANT_INTERNAL".equals(visibility) && merchant != null && merchants.contains(merchant))))
        );
    }
}
