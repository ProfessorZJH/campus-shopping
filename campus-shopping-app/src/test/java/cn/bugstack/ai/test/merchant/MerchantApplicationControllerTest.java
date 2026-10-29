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
/** 正式申请接口与响应契约；MockMvc 替身不代替数据库事务测试。 */
class MerchantApplicationControllerTest {
 private static final String URL="/api/v1/merchant-applications";
 static final String JSON="""
 {"merchantName":"校园水果店","category":"水果","contactName":"测试人","contactPhone":"10000000000","storeName":"一号店","location":"校园北门"}
 """;
 private MockMvc mvc(IMerchantApplicationService service){var c=new MerchantApplicationController();ReflectionTestUtils.setField(c,"applications",service);return MockMvcBuilders.standaloneSetup(c).build();}
 @Test void businessExceptionReturnsCodeAndInfo()throws Exception{
  var s=mock(IMerchantApplicationService.class);when(s.submitDetailed(eq("u1"),any(),eq("key"))).thenThrow(new AppException(ResponseCode.MERCHANT_REQUEST_CONFLICT));
  mvc(s).perform(post(URL).principal(()->"u1").header("Idempotency-Key","key").contentType(MediaType.APPLICATION_JSON).content(JSON)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("M0001"));
 }
 @Test void systemExceptionDoesNotLeakDetails()throws Exception{
  var s=mock(IMerchantApplicationService.class);when(s.submitDetailed(eq("u1"),any(),eq("key"))).thenThrow(new IllegalStateException("db-password=secret"));
  mvc(s).perform(post(URL).principal(()->"u1").header("Idempotency-Key","key").contentType(MediaType.APPLICATION_JSON).content(JSON)).andExpect(status().isOk()).andExpect(jsonPath("$.info").value(ResponseCode.UN_ERROR.getInfo()));
 }
 @Test void domainValidationRemainsABusinessFailure()throws Exception{
  var s=mock(IMerchantApplicationService.class);when(s.submitDetailed(eq("u1"),any(),eq("key"))).thenThrow(new AppException(ResponseCode.ILLEGAL_PARAMETER));
  mvc(s).perform(post(URL).principal(()->"u1").header("Idempotency-Key","key").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("0002"));
 }
 @Test void malformedJsonIsRejectedBeforeDomain()throws Exception{
  var s=mock(IMerchantApplicationService.class);mvc(s).perform(post(URL).principal(()->"u1").contentType(MediaType.APPLICATION_JSON).content("{")).andExpect(status().isBadRequest());verifyNoInteractions(s);
 }
 @Test void absentPrincipalCannotBeReplacedByBodyUserId()throws Exception{
  var s=mock(IMerchantApplicationService.class);mvc(s).perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(JSON)).andExpect(jsonPath("$.code").value("A0004"));verifyNoInteractions(s);
 }
}
