package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.api.IAuthApi;
import cn.bugstack.ai.trigger.http.AuthController;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** 加载真实 Spring Security、MyBatis 和 BCrypt，使用 H2 测试库跑完 HTTP 过滤器链。 */
@SpringBootTest(classes = Application.class)
@AutoConfigureMockMvc
@ActiveProfiles("session-test")
class SessionAuthenticationIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PasswordEncoder encoder;

    private static final String PASSWORD = "Test-only-password-123!";

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM mer_store");
        jdbc.update("DELETE FROM mer_merchant");
        jdbc.update("DELETE FROM mer_application");
        jdbc.update("DELETE FROM iam_user");
    }

    record Client(MockHttpSession session, String token) {}

    private Client csrf(MockHttpSession session) throws Exception {
        var request = get("/api/v1/auth/csrf");
        if (session != null) request.session(session);
        MvcResult result = mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("0000")).andReturn();
        return new Client(
            (MockHttpSession) result.getRequest().getSession(false),
            mapper.readTree(result.getResponse().getContentAsString()).at("/data/token").asText()
        );
    }

    private String register(Client client, String username) throws Exception {
        String json = mapper.writeValueAsString(java.util.Map.of("username", username, "password", PASSWORD, "displayName", "测试用户"));
        MvcResult result = mvc
            .perform(
                post("/api/v1/auth/register").session(client.session()).header("X-CSRF-TOKEN", client.token()).contentType("application/json").content(json)
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("0000"))
            .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).at("/data/userId").asText();
    }

    private MvcResult login(Client client, String username, String password) throws Exception {
        return mvc
            .perform(
                post("/api/v1/auth/login")
                    .session(client.session())
                    .header("X-CSRF-TOKEN", client.token())
                    .contentType("application/json")
                    .content(mapper.writeValueAsString(java.util.Map.of("username", username, "password", password)))
            )
            .andExpect(status().isOk())
            .andReturn();
    }

    private Client registeredSession(String username) throws Exception {
        Client client = csrf(null);
        register(client, username);
        assertEquals(
            "0000",
            mapper
                .readTree(login(client, username, PASSWORD).getResponse().getContentAsString())
                .get("code")
                .asText()
        );
        return csrf(client.session());
    }

    @Test
    void anonymousCanBrowseOnlyPublishedMerchantPaths() throws Exception {
        mvc.perform(get("/api/v1/merchants/public")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("0000"));
        mvc.perform(get("/api/v1/merchants/public/page").param("page", "1").param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("0000"))
            .andExpect(jsonPath("$.data.items").isArray());
        // 无此商户仍应走到 Controller 的业务错误，而不是被 Security 拒绝为 401。
        mvc.perform(get("/api/v1/merchants/public/non-existent-merchant")).andExpect(status().isOk()).andExpect(jsonPath("$.code").isNotEmpty());
        mvc.perform(get("/api/v1/admin/merchants/page")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchants/private/products/page")).andExpect(status().isUnauthorized());
    }

    @Test
    void controllerImplementsApiContract() {
        assertTrue(IAuthApi.class.isAssignableFrom(AuthController.class));
    }

    @Test
    void anonymousCannotQueryMeAndMissingCsrfCannotRegister() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("A0004"));
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("A0005"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM iam_user", Integer.class));
    }

    @Test
    void loginPersistsUuidPrincipalAndRotatesSessionAndCsrf() throws Exception {
        Client client = csrf(null);
        String id = register(client, "student001");
        String oldSessionId = client.session().getId();
        String storedHash = jdbc.queryForObject("SELECT password_hash FROM iam_user WHERE id=?", String.class, id);
        assertNotEquals(PASSWORD, storedHash);
        assertTrue(encoder.matches(PASSWORD, storedHash));
        JsonNode body = mapper.readTree(login(client, " STUDENT001 ", PASSWORD).getResponse().getContentAsString());
        assertEquals("0000", body.get("code").asText());
        assertEquals(id, body.at("/data/userId").asText());
        assertFalse(body.get("data").has("passwordHash"));
        assertNotEquals(oldSessionId, client.session().getId());
        SecurityContext context = (SecurityContext) client.session().getAttribute("SPRING_SECURITY_CONTEXT");
        assertEquals(id, context.getAuthentication().getName());
        assertNull(context.getAuthentication().getCredentials());
        mvc.perform(get("/api/v1/auth/me").session(client.session())).andExpect(status().isOk()).andExpect(jsonPath("$.data.userId").value(id));
        // 登录前的令牌不能用于登录后的写操作。
        mvc.perform(
            post("/api/v1/merchant-applications")
                .session(client.session())
                .header("X-CSRF-TOKEN", client.token())
                .header("Idempotency-Key", "old-token")
                .contentType("application/json")
                .content("{\"merchantName\":\"Shop\"}")
        ).andExpect(status().isForbidden());
    }

    @Test
    void unknownUserAndWrongPasswordReturnSameCodeWithoutSessionAuthentication() throws Exception {
        Client client = csrf(null);
        register(client, "student001");
        JsonNode wrong = mapper.readTree(login(client, "student001", "wrong-password").getResponse().getContentAsString());
        JsonNode absent = mapper.readTree(login(client, "absent001", "wrong-password").getResponse().getContentAsString());
        assertEquals("A0002", wrong.get("code").asText());
        assertEquals(wrong.get("code"), absent.get("code"));
        assertEquals(wrong.get("info"), absent.get("info"));
        assertNull(client.session().getAttribute("SPRING_SECURITY_CONTEXT"));
        mvc.perform(get("/api/v1/auth/me").session(client.session())).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesSessionAndOldCookieCannotAuthenticate() throws Exception {
        Client client = registeredSession("student001");
        String oldId = client.session().getId();
        mvc.perform(post("/api/v1/auth/logout").session(client.session()).header("X-CSRF-TOKEN", client.token()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("0000"))
            .andExpect(cookie().maxAge("JSESSIONID", 0));
        assertTrue(client.session().isInvalid());
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("JSESSIONID", oldId))).andExpect(status().isUnauthorized());
    }

    @Test
    void disabledAccountIsRejectedOnNextRequestAndSessionIsDestroyed() throws Exception {
        Client client = registeredSession("student001");
        jdbc.update("UPDATE iam_user SET status='DISABLED' WHERE username='student001'");
        mvc.perform(get("/api/v1/auth/me").session(client.session())).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("A0003"));
        assertTrue(client.session().isInvalid());
    }

    @Test
    void disabledAccountCannotLogInWithCorrectPassword() throws Exception {
        Client client = csrf(null);
        register(client, "student001");
        jdbc.update("UPDATE iam_user SET status='DISABLED' WHERE username='student001'");
        JsonNode body = mapper.readTree(login(client, "student001", PASSWORD).getResponse().getContentAsString());
        assertEquals("A0003", body.get("code").asText());
        assertNull(client.session().getAttribute("SPRING_SECURITY_CONTEXT"));
    }

    @Test
    void merchantUsesAuthenticatedUuidAndIdempotencyIsScopedByUser() throws Exception {
        Client a = registeredSession("student001");
        Client b = registeredSession("student002");
        String idA = jdbc.queryForObject("SELECT id FROM iam_user WHERE username='student001'", String.class);
        for (Client client : new Client[] { a, a, b }) {
            mvc.perform(
                post("/api/v1/merchant-applications")
                    .session(client.session())
                    .header("X-CSRF-TOKEN", client.token())
                    .header("Idempotency-Key", "shared-key")
                    .contentType("application/json")
                    .content(
                        """
                        {"merchantName":"Shop","category":"水果","contactName":"测试人","contactPhone":"10000000000","storeName":"一号店","location":"北门","applicantUserId":"forged-user"}
                        """
                    )
            )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("0000"));
        }
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM mer_application", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM mer_application WHERE applicant_user_id=?", Integer.class, idA));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM mer_application WHERE applicant_user_id='forged-user'", Integer.class));
    }

    @Test
    void ordinaryAccountCannotReachAdminAndAuthenticatedUserCannotRelogin() throws Exception {
        Client client = registeredSession("student001");
        mvc.perform(get("/api/v1/admin/merchants").session(client.session())).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("A0006"));
        mvc.perform(
            post("/api/v1/auth/login").session(client.session()).header("X-CSRF-TOKEN", client.token()).contentType("application/json").content("{}")
        ).andExpect(status().isForbidden());
    }

    @Test
    void badJsonIs400AndDoesNotRegisterUser() throws Exception {
        Client client = csrf(null);
        mvc.perform(
            post("/api/v1/auth/register").session(client.session()).header("X-CSRF-TOKEN", client.token()).contentType("application/json").content("{")
        ).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM iam_user", Integer.class));
    }
}
