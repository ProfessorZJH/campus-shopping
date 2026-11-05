package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.qiniu.http.Response;
import com.qiniu.storage.UpCompletionHandler;
import com.qiniu.storage.UploadManager;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 上传异步桥接的定向单元测试：只替换本网关持有的 SDK UploadManager 字段，
 * 不反射 SDK 内部实现，也不真正等待 60 秒或发起任何网络请求。
 */
@ExtendWith(OutputCaptureExtension.class)
class QiniuObjectGatewayAsyncTest {

    private static final String KEY = "qiniu/" + UUID.randomUUID() + ".png";

    @Test
    void interruptBecomesSanitizedFailureAndLateResponseIsClosed() throws Exception {
        QiniuObjectGateway gateway = gateway();
        UploadManager manager = mock(UploadManager.class);
        ReflectionTestUtils.setField(gateway, "uploadManager", manager);
        AtomicReference<UpCompletionHandler> handler = new AtomicReference<>();
        doAnswer(invocation -> {
            handler.set(invocation.getArgument(6));
            return null;
        })
            .when(manager)
            .asyncPut(any(byte[].class), anyString(), anyString(), any(), anyString(), anyBoolean(), any());
        Response late = mock(Response.class);
        try {
            Thread.currentThread().interrupt();
            AppException failure = assertThrows(AppException.class, () -> gateway.upload(new byte[] { 1, 2, 3 }, KEY));

            assertEquals(ResponseCode.UN_ERROR.getCode(), failure.getCode());
            assertNull(failure.getCause(), "脱敏业务异常不得挂下游异常作 cause");
            assertTrue(Thread.currentThread().isInterrupted(), "中断标记必须被恢复");
        } finally {
            // 无论断言是否失败都清理中断标记，避免污染复用的 JUnit 线程。
            Thread.interrupted();
        }

        // 等待已放弃后，迟到回调仍必须关闭响应，避免连接泄漏。
        assertNotNull(handler.get(), "必须捕获 SDK 回调");
        handler.get().complete(KEY, late);
        verify(late).close();
    }

    @Test
    void startupIoExceptionIsSanitizedWithoutCauseOrBody(CapturedOutput output) throws Exception {
        String sentinel = "fake-downstream-body";
        QiniuObjectGateway gateway = gateway();
        UploadManager manager = mock(UploadManager.class);
        ReflectionTestUtils.setField(gateway, "uploadManager", manager);
        doThrow(new IOException(sentinel)).when(manager).asyncPut(any(byte[].class), anyString(), anyString(), any(), anyString(), anyBoolean(), any());

        AppException failure = assertThrows(AppException.class, () -> gateway.upload(new byte[] { 1, 2, 3 }, KEY));

        assertEquals(ResponseCode.UN_ERROR.getCode(), failure.getCode());
        assertNull(failure.getCause(), "启动 IOException 不得作为 cause 透出");
        assertFalse(String.valueOf(failure.getMessage()).contains(sentinel), "异常信息不得包含下游正文");
        assertFalse(output.getAll().contains(sentinel), "日志不得输出下游正文");
    }

    /** 完整假七牛配置：构造器只创建 SDK 对象，不发起任何请求。 */
    private static QiniuObjectGateway gateway() {
        ProductImageStorageProperties props = new ProductImageStorageProperties();
        props.setProvider("QINIU");
        ProductImageStorageProperties.Qiniu qiniu = props.getQiniu();
        qiniu.setAccessKey("fake-access-key");
        qiniu.setSecretKey("fake-secret-key");
        qiniu.setBucket("fake-bucket");
        qiniu.setDownloadDomain("images.example.com");
        // 上传必须显式固定区域；auto 会在 SDK 内联网发现并可能打印异常栈。
        qiniu.setRegion("z0");
        return new QiniuObjectGateway(props, Clock.fixed(Instant.parse("2026-11-05T00:00:00Z"), ZoneOffset.UTC));
    }
}
