package cn.bugstack.ai.test.merchant;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.api.response.Response;
import org.junit.jupiter.api.Test;

/** 验证与 group-buy-market 相同的 Lombok Response.Builder 契约。 */
class ResponseFactoryTest {

    @Test
    void builderResponseContainsCodeAndInfoWithoutData() {
        Response<Void> response = Response.<Void>builder().code("M0001").info("幂等请求冲突").build();
        assertEquals("M0001", response.getCode());
        assertEquals("幂等请求冲突", response.getInfo());
        assertNull(response.getData());
    }
}
