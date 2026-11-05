package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageRef;
import cn.bugstack.ai.infrastructure.adapter.repository.ProductImageRepository;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.ProductImagePO;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

/** 七牛上传契约：真实 JPEG 重编码为 PNG 后先上传、成功登记才返回安全引用；替身上传，不代表真实云端联调。 */
class QiniuImageContractTest {

    @TempDir
    Path uploadDir;

    private ICatalogDao dao;
    private QiniuObjectGateway gateway;
    private ProductImageRepository repository;

    @BeforeEach
    void setUp() {
        dao = mock(ICatalogDao.class);
        gateway = mock(QiniuObjectGateway.class);
        var properties = new ProductImageStorageProperties();
        properties.setProvider("QINIU");
        repository = new ProductImageRepository();
        ReflectionTestUtils.setField(repository, "dao", dao);
        ReflectionTestUtils.setField(repository, "properties", properties);
        ReflectionTestUtils.setField(repository, "qiniu", gateway);
        ReflectionTestUtils.setField(repository, "uploadDir", uploadDir.toString());
    }

    @Test
    void jpegIsReencodedPngThenUploadedAndRegistered() throws Exception {
        when(gateway.upload(any(byte[].class), anyString())).thenAnswer(invocation -> invocation.getArgument(1));
        when(dao.registerProductImageUpload(anyString(), eq("m"))).thenReturn(1);
        var png = ArgumentCaptor.forClass(byte[].class);
        var key = ArgumentCaptor.forClass(String.class);

        String url = repository.storeImage(jpeg(), "m");

        assertTrue(url.matches("/media/qiniu/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png"), url);
        verify(gateway).upload(png.capture(), key.capture());
        assertEquals("qiniu/" + url.substring("/media/qiniu/".length()), key.getValue());
        byte[] bytes = png.getValue();
        assertEquals((byte) 0x89, bytes[0]);
        assertEquals("PNG", new String(bytes, 1, 3, java.nio.charset.StandardCharsets.US_ASCII));
        assertNotNull(ImageIO.read(new java.io.ByteArrayInputStream(bytes)));
        InOrder order = inOrder(gateway, dao);
        order.verify(gateway).upload(any(byte[].class), eq(key.getValue()));
        order.verify(dao).registerProductImageUpload(key.getValue(), "m");
        try (var files = Files.list(uploadDir)) {
            assertEquals(0, files.count());
        }
    }

    @Test
    void uploadFailureNeverRegistersOrReturnsUrl() throws Exception {
        when(gateway.upload(any(byte[].class), anyString())).thenThrow(new AppException(ResponseCode.UN_ERROR));

        assertEquals(ResponseCode.UN_ERROR.getCode(), assertThrows(AppException.class, () -> repository.storeImage(jpeg(), "m")).getCode());
        verify(dao, never()).registerProductImageUpload(anyString(), anyString());
        try (var files = Files.list(uploadDir)) {
            assertEquals(0, files.count());
        }
    }

    @Test
    void registrationFailureReturnsNoUrl() throws Exception {
        when(gateway.upload(any(byte[].class), anyString())).thenAnswer(invocation -> invocation.getArgument(1));
        when(dao.registerProductImageUpload(anyString(), eq("m"))).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> repository.storeImage(jpeg(), "m"));

        verify(gateway).upload(any(byte[].class), anyString());
        verify(dao).registerProductImageUpload(anyString(), eq("m"));
        try (var files = Files.list(uploadDir)) {
            assertEquals(0, files.count());
        }
    }

    /** 保存阶段只依赖已登记对象和现存本地文件，不访问云端。 */
    @Test
    void mixedProvidersKeepOrderWithoutGatewayCallsOnSave() throws Exception {
        String local = "/media/" + UUID.randomUUID() + ".png";
        Files.write(uploadDir.resolve(local.substring("/media/".length())), png());
        String qiniuA = qiniuUrl();
        String qiniuB = qiniuUrl();
        List<String> urls = List.of(qiniuA, local, qiniuB);
        when(dao.claimProductImage(anyString(), eq("m"), eq("p"))).thenReturn(1);
        var rows = ArgumentCaptor.forClass(ProductImagePO.class);

        repository.replace("p", "m", urls);

        verifyNoInteractions(gateway);
        verify(dao).deleteProductImages("p");
        verify(dao, times(3)).insertProductImage(rows.capture());
        List<ProductImagePO> saved = rows.getAllValues();
        for (int i = 0; i < urls.size(); i++) {
            assertEquals(i, saved.get(i).getSortOrder());
            assertEquals(urls.get(i), saved.get(i).getUrl());
            assertEquals(urls.get(i).startsWith("/media/qiniu/") ? "QINIU" : "LOCAL", saved.get(i).getProvider());
            assertEquals(ProductImageRef.of(urls.get(i)).objectKey(), saved.get(i).getObjectKey());
        }
    }

    /** 未登记、其他商户或其他商品已占用的对象一律拒绝，且不改动图片行；原商品历史认领仍可保存。 */
    @Test
    void unregisteredForeignOrOtherProductObjectsAreRejectedAndHistoryKept() {
        String qiniu = qiniuUrl();
        String key = "qiniu/" + qiniu.substring("/media/qiniu/".length());
        when(dao.claimProductImage(anyString(), anyString(), anyString())).thenReturn(0);
        when(dao.productImageClaims("p")).thenReturn(List.of());

        assertEquals("A0006", assertThrows(AppException.class, () -> repository.replace("p", "m", List.of(qiniu))).getCode());
        assertEquals("A0006", assertThrows(AppException.class, () -> repository.replace("p", "m2", List.of(qiniu))).getCode());

        verify(dao).claimProductImage(key, "m", "p");
        verify(dao).claimProductImage(key, "m2", "p");
        verify(dao, never()).deleteProductImages(anyString());
        verify(dao, never()).insertProductImage(any(ProductImagePO.class));

        clearInvocations(dao);
        when(dao.productImageClaims("p")).thenReturn(List.of(key));
        repository.replace("p", "m", List.of(qiniu));
        verify(dao).deleteProductImages("p");
        verify(dao).insertProductImage(any(ProductImagePO.class));
    }

    /** 2_000_000 字节是精确上限：等号内可解码保存，超一字节在上传前拒绝。 */
    @Test
    void byteLimitIsExactAndCheckedBeforeUpload() throws Exception {
        when(gateway.upload(any(byte[].class), anyString())).thenAnswer(invocation -> invocation.getArgument(1));
        when(dao.registerProductImageUpload(anyString(), eq("m"))).thenReturn(1);
        byte[] png = padded(png(), 2_000_000);
        byte[] jpeg = padded(jpeg(), 2_000_000);

        assertEquals(
            ResponseCode.UPLOAD_INVALID.getCode(),
            assertThrows(AppException.class, () -> repository.storeImage(padded(png(), 2_000_001), "m")).getCode()
        );
        verifyNoInteractions(gateway);

        assertTrue(repository.storeImage(png, "m").startsWith("/media/qiniu/"));
        assertTrue(repository.storeImage(jpeg, "m").startsWith("/media/qiniu/"));
        verify(gateway, times(2)).upload(any(byte[].class), anyString());
    }

    private String qiniuUrl() {
        return "/media/qiniu/" + UUID.randomUUID() + ".png";
    }

    private static byte[] padded(byte[] base, int size) {
        return java.util.Arrays.copyOf(base, size);
    }

    private byte[] png() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private byte[] jpeg() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }
}
