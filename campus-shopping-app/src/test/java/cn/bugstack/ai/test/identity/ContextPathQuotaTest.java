package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.trigger.http.AuthenticationRateFilter;
import cn.bugstack.ai.trigger.http.ProtectedQuotaFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ContextPathQuotaTest {

    @Test
    void loginAndRegistrationHaveSameLimitsUnderDeploymentPrefix() throws Exception {
        for (String context : new String[] { "", "/campus" }) {
            for (String action : new String[] { "login", "register" }) {
                IRequestQuotaRepository quotas = (policy, subject, permits, seconds) -> {
                    assertEquals(action + "-source", policy);
                    return 11;
                };
                var filter = new AuthenticationRateFilter(new ObjectMapper(), true, quotas);
                var request = request(context, "/api/v1/auth/" + action);
                var response = new MockHttpServletResponse();
                filter.doFilter(request, response, (r, s) -> fail("限流不得被前缀绕过"));
                assertEquals(429, response.getStatus());
                assertEquals("11", response.getHeader("Retry-After"));
            }
        }
    }

    @Test
    void aiAndPickupQuotasUseApplicationPathAndCorrectMerchant() throws Exception {
        for (String context : new String[] { "", "/campus" }) {
            for (String path : new String[] { "/api/v1/ai/chat", "/api/v1/merchants/m42/orders/o1/verify" }) {
                var subjects = new ArrayList<String>();
                IRequestQuotaRepository quotas = (policy, subject, permits, seconds) -> {
                    subjects.add(policy + ":" + subject);
                    return subjects.size() == 2 ? 7 : 0;
                };
                var filter = new ProtectedQuotaFilter(quotas, new ObjectMapper(), true);
                var request = request(context, path);
                request.setUserPrincipal(() -> "u1");
                var response = new MockHttpServletResponse();
                filter.doFilter(request, response, (r, s) -> fail("保护额度必须执行"));
                assertEquals(429, response.getStatus());
                assertEquals(path.endsWith("chat") ? "ai-global:all" : "pickup-merchant:m42", subjects.get(1));
            }
        }
    }

    private MockHttpServletRequest request(String context, String path) {
        var request = new MockHttpServletRequest("POST", context + path);
        request.setContextPath(context);
        return request;
    }
}
