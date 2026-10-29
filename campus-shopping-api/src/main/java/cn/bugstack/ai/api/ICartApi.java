package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 CartController 实现。 */
public interface ICartApi {
    /** 本人购物车，展示实时价格与可售状态。 */
    Response<List<CartResponseDTO>> cart(Principal principal);
    /** 设置本人购物车数量。 */
    Response<Void> set(CartSetRequestDTO request, Principal principal);
    /** 移除本人购物车商品。 */
    Response<Void> delete(String skuId, Principal principal);
}
