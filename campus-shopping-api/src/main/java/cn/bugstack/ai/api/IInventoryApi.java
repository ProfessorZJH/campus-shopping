package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 InventoryController 实现。 */
public interface IInventoryApi {
    /** 商户库存三量查询。 */
    Response<List<StockResponseDTO>> stocks(String merchantId, int page, int size, Principal principal);
    Response<PageResponseDTO<StockResponseDTO>> stocksPage(String merchantId, int page, int size, String q, Principal principal);
    /** 按请求键幂等补货。 */
    Response<Void> replenish(String merchantId, String skuId, ReplenishRequestDTO request, String key, Principal principal);
    /** 本商户库存流水。 */
    Response<List<StockMovementResponseDTO>> movements(String merchantId, int page, int size, Principal principal);
    Response<PageResponseDTO<StockMovementResponseDTO>> movementsPage(String merchantId, int page, int size, Principal principal);
}
