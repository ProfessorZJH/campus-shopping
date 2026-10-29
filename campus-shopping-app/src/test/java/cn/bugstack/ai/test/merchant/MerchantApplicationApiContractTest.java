package cn.bugstack.ai.test.merchant;
import cn.bugstack.ai.api.IMerchantApplicationApi;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.service.IMerchantApplicationService;
import cn.bugstack.ai.trigger.http.MerchantApplicationController;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
/** API 声明与 Trigger 实现必须一致，申请人取自认证主体。 */
class MerchantApplicationApiContractTest {
 @Test void implementsApi(){assertTrue(IMerchantApplicationApi.class.isAssignableFrom(MerchantApplicationController.class));}
 @Test void bindsTrustedActorAndCompleteDetails()throws Exception{
  var s=mock(IMerchantApplicationService.class);var details=new AdmissionCommandEntity("校园水果店","水果","测试人","10000000000","一号店","校园北门");
  when(s.submitDetailed(eq("u1"),eq(details),eq("key"))).thenReturn(MerchantApplicationAggregate.submitDetailed("a1","u1",details));
  var c=new MerchantApplicationController();ReflectionTestUtils.setField(c,"applications",s);
  MockMvcBuilders.standaloneSetup(c).build().perform(post("/api/v1/merchant-applications").principal(()->"u1").header("Idempotency-Key","key").contentType(MediaType.APPLICATION_JSON).content(MerchantApplicationControllerTest.JSON)).andExpect(status().isOk()).andExpect(jsonPath("$.data.applicationId").value("a1"));
  verify(s).submitDetailed("u1",details,"key");
 }
}
