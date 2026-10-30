package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.trigger.http.ApiProtocolExceptionResolver;
import cn.bugstack.ai.trigger.http.AuthenticationRateFilter;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ProtocolBoundaryTest {

    @Test
    void resolverDoesNotHandleBusinessOrUnexpectedRuntimeExceptions() throws Exception {
        var resolver = new ApiProtocolExceptionResolver(new ObjectMapper());
        var request = new MockHttpServletRequest("GET", "/api/v1/orders");
        var response = new MockHttpServletResponse();
        assertNull(resolver.resolveException(request, response, null, new AppException(ResponseCode.ORDER_STATE_INVALID)));
        assertNull(resolver.resolveException(request, response, null, new IllegalStateException("private detail")));
        assertEquals("", response.getContentAsString());
    }

    @Test
    void registrationRetryAfterMatchesItsFiveMinuteWindow() throws Exception {
        verifyRateLimit("/api/v1/auth/register", 10, 299, 300);
        verifyRateLimit("/api/v1/auth/login", 30, 59, 60);
    }

    private void verifyRateLimit(String path, int limit, int minimum, int maximum) throws Exception {
        var mapper = new ObjectMapper();
        var filter = new AuthenticationRateFilter(mapper);
        var request = new MockHttpServletRequest("POST", path);
        for (int i = 0; i < limit; i++) {
            var allowed = new MockHttpServletResponse();
            filter.doFilter(request, allowed, (r, s) -> s.getWriter().write("allowed"));
            assertEquals("allowed", allowed.getContentAsString());
        }
        var rejected = new MockHttpServletResponse();
        filter.doFilter(request, rejected, (r, s) -> fail("超限请求不得进入后续过滤器"));
        assertEquals(429, rejected.getStatus());
        assertEquals("A0007", mapper.readTree(rejected.getContentAsString()).get("code").asText());
        int retry = Integer.parseInt(rejected.getHeader("Retry-After"));
        assertTrue(retry >= minimum && retry <= maximum);
    }
}
