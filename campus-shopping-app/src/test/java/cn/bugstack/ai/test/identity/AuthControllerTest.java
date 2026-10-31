package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.api.IAuthApi;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.trigger.http.AuthController;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** MVC 接口测试不加载 SecurityFilterChain；安全规则须另做集成测试。 */
class AuthControllerTest {

  private static final String REGISTER_JSON =
    "{\"username\":\"student001\",\"password\":\"MySecurePass123!\",\"displayName\":\"校园用户\"}";

  private MockMvc mvc(IUserAccountService service) {
    AuthController controller = new AuthController();
    ReflectionTestUtils.setField(controller, "userAccountService", service);
    return MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void triggerMustImplementApiContract() {
    assertTrue(IAuthApi.class.isAssignableFrom(AuthController.class));
  }

  @Test
  void successReturnsOnlyUserId() throws Exception {
    IUserAccountService service = mock(IUserAccountService.class);
    when(service.register("student001", "MySecurePass123!", "校园用户")).thenReturn(
      UserAccountAggregate.register("user-1", "student001", "校园用户")
    );
    mvc(service)
      .perform(
        post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_JSON)
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value("0000"))
      .andExpect(jsonPath("$.data.userId").value("user-1"))
      .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
  }

  @Test
  void duplicateUsernameReturnsBusinessCode() throws Exception {
    IUserAccountService service = mock(IUserAccountService.class);
    when(service.register(anyString(), anyString(), anyString())).thenThrow(
      new AppException(ResponseCode.AUTH_USERNAME_EXISTS)
    );
    mvc(service)
      .perform(
        post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_JSON)
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value("A0001"));
  }

  @Test
  void malformedJsonIsRejectedBeforeController() throws Exception {
    IUserAccountService service = mock(IUserAccountService.class);
    mvc(service)
      .perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content("{"))
      .andExpect(status().isBadRequest());
    verifyNoInteractions(service);
  }
}
