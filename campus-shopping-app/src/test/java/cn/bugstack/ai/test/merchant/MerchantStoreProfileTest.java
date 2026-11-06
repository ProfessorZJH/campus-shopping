package cn.bugstack.ai.test.merchant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.merchant.impl.MerchantAdmissionCaseImpl;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.adapter.port.IStoreImagePort;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantApplicationService;
import cn.bugstack.ai.domain.merchant.service.impl.MerchantServiceImpl;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

/** 门店资料保存与图片上传的授权边界；真实 SQL 归属由 MySQL 集成测试覆盖。 */
class MerchantStoreProfileTest {

    private final IMerchantRepository repository = mock(IMerchantRepository.class);
    private final IStoreImagePort images = mock(IStoreImagePort.class);
    private final MerchantServiceImpl service = new MerchantServiceImpl(repository, images);

    @Test
    void legacyProfileUpdateKeepsExtendedStoreFields() {
        when(repository.find("m1", true)).thenReturn(merchant("介绍", "08:00-20:00", "/media/qiniu/store.png"));
        service.updateProfile("m1", "新名称", "新门店", "新地点");
        verify(repository).updateProfile("m1", "新名称", "新门店", "新地点", "介绍", "08:00-20:00", "/media/qiniu/store.png");
    }

    @Test
    void crossMerchantImageIsRejectedBeforeWrite() {
        when(repository.find("m1", true)).thenReturn(merchant("", "", ""));
        doThrow(new AppException(ResponseCode.AUTH_FORBIDDEN)).when(images).requireOwned("m1", "/media/qiniu/other.png");
        var error = assertThrows(AppException.class, () ->
            service.updateProfile("m1", "名称", "门店", "地点", "介绍", "08:00-20:00", "/media/qiniu/other.png")
        );
        assertEquals("A0006", error.getCode());
        verify(repository, never()).updateProfile(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void storeImageUploadRequiresStoreManagePermission() {
        IAccessService access = mock(IAccessService.class);
        doThrow(new AppException(ResponseCode.AUTH_FORBIDDEN)).when(access).requirePermission("clerk", "m1", "store.manage");
        var admission = new MerchantAdmissionCaseImpl(mock(IMerchantApplicationService.class), service, access);
        var error = assertThrows(AppException.class, () -> admission.uploadStoreImage("clerk", "m1", new byte[] { 1 }));
        assertEquals("A0006", error.getCode());
        verify(images, never()).storeImage(any(), anyString());
    }

    @Test
    void storeImageRejectsUnknownMerchantBeforeObjectWrite() {
        when(repository.find("missing", false)).thenReturn(null);
        var error = assertThrows(AppException.class, () -> service.storeImage("missing", new byte[] { 1 }));
        assertEquals("G0001", error.getCode());
        verify(images, never()).storeImage(any(), anyString());
    }

    private MerchantVO merchant(String description, String hours, String image) {
        return new MerchantVO("m1", "a1", "名称", "stationery", "ACTIVE", "s1", "门店", "地点", description, hours, image);
    }
}
