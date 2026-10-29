package cn.bugstack.ai.test.merchant;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 业务错误码集中在 ResponseCode，并由 AppException 承载。 */
class MerchantExceptionContractTest {

    @Test
    void errorCodeMessageAndCauseMustBePreserved() {
        IllegalStateException cause = new IllegalStateException("底层错误");
        AppException ex = new AppException("M0001", "幂等请求冲突", cause);
        assertEquals("M0001", ex.getCode());
        assertEquals("幂等请求冲突", ex.getInfo());
        assertEquals("幂等请求冲突", ex.getMessage());
        assertSame(cause, ex.getCause());
    }

    @Test
    void merchantCodeIsDefinedInResponseCode() {
        AppException ex = new AppException(ResponseCode.MERCHANT_REQUEST_CONFLICT);
        assertEquals("M0001", ex.getCode());
        assertEquals(ResponseCode.MERCHANT_REQUEST_CONFLICT.getInfo(), ex.getMessage());
    }

    @Test
    void commonResponseCodeConstructorStillWorks() {
        AppException ex = new AppException(ResponseCode.ILLEGAL_PARAMETER);
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), ex.getCode());
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getInfo(), ex.getMessage());
    }
}
