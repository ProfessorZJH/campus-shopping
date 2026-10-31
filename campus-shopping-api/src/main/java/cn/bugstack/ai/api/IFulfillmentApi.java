package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 FulfillmentController 实现。 */
public interface IFulfillmentApi {
  /** 开始备货。 */
  Response<Void> prepare(String merchantId, String orderId, Principal principal);
  /** 备货完成。 */
  Response<Void> ready(String merchantId, String orderId, Principal principal);
  /** 本人领取或重新签发自提凭证，旧凭证立即失效。 */
  Response<TokenResponseDTO> token(String orderId, Principal principal);
  /** 店员单次核销，订单完成和库存出库原子提交。 */
  Response<OrderResponseDTO> verify(
    String merchantId,
    String orderId,
    VerifyPickupRequestDTO request,
    Principal principal
  );
}
