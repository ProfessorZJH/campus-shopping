package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IMerchantApplicationApi;
import cn.bugstack.ai.api.dto.AdmissionResponseDTO;
import cn.bugstack.ai.api.dto.MerchantProfileRequestDTO;
import cn.bugstack.ai.api.dto.MerchantResponseDTO;
import cn.bugstack.ai.api.dto.PageResponseDTO;
import cn.bugstack.ai.api.dto.ReviewRequestDTO;
import cn.bugstack.ai.api.dto.StateRequestDTO;
import cn.bugstack.ai.api.dto.SubmitMerchantApplicationRequestDTO;
import cn.bugstack.ai.api.dto.SubmitMerchantApplicationResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.merchant.IMerchantAdmissionCase;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.service.IMerchantApplicationService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class MerchantApplicationController implements IMerchantApplicationApi {

    @Resource
    private IMerchantApplicationService applications;

    @Resource
    private IMerchantAdmissionCase admission;

    @Resource
    private IAccessService access;

    @Resource
    private IMerchantService merchants;

    /** 提交完整申请，申请人由 Session 确定。 */
    @Override
    @PostMapping("/merchant-applications")
    public Response<SubmitMerchantApplicationResponseDTO> submit(
        @RequestBody SubmitMerchantApplicationRequestDTO request,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        Principal principal
    ) {
        return execute(() -> {
            required(request);
            var a = applications.submitDetailed(
                actor(principal),
                new AdmissionCommandEntity(
                    request.getMerchantName(),
                    request.getCategory(),
                    request.getContactName(),
                    request.getContactPhone(),
                    request.getStoreName(),
                    request.getLocation()
                ),
                idempotencyKey
            );
            return SubmitMerchantApplicationResponseDTO.builder().applicationId(a.getApplicationId()).status(a.getStatus().name()).build();
        });
    }

    /** 查询本人申请历史。 */
    @Override
    @GetMapping("/merchant-applications/mine")
    public Response<List<AdmissionResponseDTO>> mine(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            return applications.list(actor(principal), null, page, size).stream().map(ApiViews::admission).toList();
        });
    }

    @Override
    @GetMapping("/merchant-applications/mine/page")
    public Response<PageResponseDTO<AdmissionResponseDTO>> minePage(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            String actor = actor(principal);
            return PageResponseDTO.of(
                applications.list(actor, null, page, size).stream().map(ApiViews::admission).toList(),
                page,
                size,
                applications.count(actor, null)
            );
        });
    }

    /** 平台分页审核列表。 */
    @Override
    @GetMapping("/admin/merchant-applications")
    public Response<List<AdmissionResponseDTO>> pending(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            access.requireAdmin(actor(principal));
            return applications.list(null, state, page, size).stream().map(ApiViews::admission).toList();
        });
    }

    @Override
    @GetMapping("/admin/merchant-applications/page")
    public Response<PageResponseDTO<AdmissionResponseDTO>> pendingPage(
        @RequestParam(required = false) String state,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String q,
        Principal principal
    ) {
        return execute(() -> {
            access.requireAdmin(actor(principal));
            return PageResponseDTO.of(
                applications.list(null, state, page, size, q).stream().map(ApiViews::admission).toList(),
                page,
                size,
                applications.count(null, state, q)
            );
        });
    }

    /** 审核通过时原子创建商户、门店和 Owner。 */
    @Override
    @PostMapping("/admin/merchant-applications/{applicationId}/review")
    public Response<MerchantResponseDTO> review(
        @PathVariable("applicationId") String applicationId,
        @RequestBody ReviewRequestDTO request,
        Principal principal
    ) {
        return execute(() -> {
            required(request);
            boolean approved = required(request.getApproved());
            if (approved) return ApiViews.merchant(admission.approve(actor(principal), applicationId));
            admission.reject(actor(principal), applicationId, request.getReason());
            return null;
        });
    }

    /** 公开营业商户列表。 */
    @Override
    @GetMapping("/merchants/public")
    public Response<List<MerchantResponseDTO>> publicMerchants(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size) {
        return execute(() -> {
            return merchants.list(page, size, true).stream().map(ApiViews::merchant).toList();
        });
    }

    /** 公开商户详情只返回营业中的商户；不泄露停用商户资料。 */
    @Override
    @GetMapping("/merchants/public/{merchantId}")
    public Response<MerchantResponseDTO> publicMerchant(@PathVariable("merchantId") String merchantId) {
        return execute(() -> {
            var m = merchants.find(merchantId);
            require("ACTIVE".equals(m.status()), ResponseCode.MERCHANT_SUSPENDED);
            return ApiViews.merchant(m);
        });
    }

    /** 平台商户监管列表。 */
    @Override
    @GetMapping("/admin/merchants")
    public Response<List<MerchantResponseDTO>> allMerchants(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        Principal principal
    ) {
        return execute(() -> {
            access.requireAdmin(actor(principal));
            return merchants.list(page, size, false).stream().map(ApiViews::merchant).toList();
        });
    }

    @Override
    @GetMapping("/merchants/public/page")
    public Response<PageResponseDTO<MerchantResponseDTO>> publicMerchantsPage(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return execute(() -> PageResponseDTO.of(merchants.list(page, size, true).stream().map(ApiViews::merchant).toList(), page, size, merchants.count(true)));
    }

    @Override
    @GetMapping("/admin/merchants/page")
    public Response<PageResponseDTO<MerchantResponseDTO>> adminMerchantsPage(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String q,
        Principal principal
    ) {
        return execute(() -> {
            access.requireAdmin(actor(principal));
            return PageResponseDTO.of(merchants.list(page, size, false, q).stream().map(ApiViews::merchant).toList(), page, size, merchants.count(false, q));
        });
    }

    /** 停用或恢复经营，历史数据不删除。 */
    @Override
    @PostMapping("/admin/merchants/{merchantId}/state")
    public Response<Void> merchantState(@PathVariable("merchantId") String merchantId, @RequestBody StateRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);
            admission.setActive(actor(principal), merchantId, required(request.getActive()), request.getReason());
            return null;
        });
    }

    /** 商户资料修改仍通过领域用例，不能由 HTTP 入口直接修改门店表。 */
    @Override
    @PutMapping("/merchants/{merchantId}/profile")
    public Response<MerchantResponseDTO> updateProfile(
        @PathVariable("merchantId") String merchantId,
        @RequestBody MerchantProfileRequestDTO request,
        Principal principal
    ) {
        return execute(() -> {
            required(request);
            return ApiViews.merchant(admission.updateProfile(actor(principal), merchantId, request.getName(), request.getStoreName(), request.getLocation()));
        });
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try {
            return ApiResponses.success(action.get());
        } catch (AppException e) {
            ControllerFailures.record(log, e);
            return ApiResponses.rejected(e);
        } catch (Exception e) {
            ControllerFailures.unexpected(log, e);
            return ApiResponses.unexpected();
        }
    }
}
