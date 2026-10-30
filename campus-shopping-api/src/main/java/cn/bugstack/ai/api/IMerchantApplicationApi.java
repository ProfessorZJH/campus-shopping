package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 MerchantApplicationController 实现。 */
public interface IMerchantApplicationApi {
    /** 提交完整申请，申请人由 Session 确定。 */
    Response<SubmitMerchantApplicationResponseDTO> submit(SubmitMerchantApplicationRequestDTO request, String idempotencyKey, Principal principal);
    /** 查询本人申请历史。 */
    Response<List<AdmissionResponseDTO>> mine(int page, int size, Principal principal);
    Response<PageResponseDTO<AdmissionResponseDTO>> minePage(int page, int size, Principal principal);
    /** 平台分页审核列表。 */
    Response<List<AdmissionResponseDTO>> pending(String state, int page, int size, Principal principal);
    Response<PageResponseDTO<AdmissionResponseDTO>> pendingPage(String state, int page, int size, String q, Principal principal);
    /** 审核通过时原子创建商户、门店和 Owner。 */
    Response<MerchantResponseDTO> review(String applicationId, ReviewRequestDTO request, Principal principal);
    /** 公开营业商户列表。 */
    Response<List<MerchantResponseDTO>> publicMerchants(int page, int size);
    /** 按 ID 读取营业中的公开商户详情。 */
    Response<MerchantResponseDTO> publicMerchant(String merchantId);
    Response<PageResponseDTO<MerchantResponseDTO>> publicMerchantsPage(int page, int size);
    Response<PageResponseDTO<MerchantResponseDTO>> adminMerchantsPage(int page, int size, String q, Principal principal);
    /** 平台商户监管列表。 */
    Response<List<MerchantResponseDTO>> allMerchants(int page, int size, Principal principal);
    /** 停用或恢复经营，历史数据不删除。 */
    Response<Void> merchantState(String merchantId, StateRequestDTO request, Principal principal);
    /** Owner 更新商户与自提门店资料。 */
    Response<MerchantResponseDTO> updateProfile(String merchantId, MerchantProfileRequestDTO request, Principal principal);
}
