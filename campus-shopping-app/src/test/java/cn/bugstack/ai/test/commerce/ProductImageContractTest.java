package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.service.impl.CatalogServiceImpl;
import cn.bugstack.ai.infrastructure.adapter.repository.ProductImageRepository;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.ProductImagePO;
import cn.bugstack.ai.types.exception.AppException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 商品多图第一阶段契约：数量、格式、去重、对象归属与主图兼容。
 * 使用显式替身验证规则，不代表 Spring/MySQL 联调结果。
 */
class ProductImageContractTest {

    private Path uploadDir;

    @BeforeEach
    void createUploadDir() throws Exception {
        uploadDir = Files.createTempDirectory("campus-image-test");
    }

    @AfterEach
    void deleteUploadDir() throws Exception {
        try (var paths = Files.walk(uploadDir)) {
            paths.sorted((a, b) -> b.getNameCount() - a.getNameCount()).forEach(path -> path.toFile().delete());
        }
    }

    @Test
    void productAcceptsZeroToOneFourAndEightImages() {
        var repository = mock(ICatalogRepository.class);
        var images = mock(IProductImageRepository.class);
        var catalog = catalog(repository, images);
        var captor = listCaptor();

        for (int count : new int[] { 0, 1, 4, 8 }) {
            catalog.create("m", "s", command(urls(count)));
        }

        // 新建商品走插入路径（不先删除空范围，避免不同商品的间隙锁），编辑才替换。
        verify(images, times(4)).insertInitial(anyString(), eq("m"), captor.capture());
        assertEquals(List.of(0, 1, 4, 8), captor.getAllValues().stream().map(List::size).toList());
        verify(repository, times(4)).insert(any());
    }

    @Test
    void productRejectsNineImagesMalformedUrlAndDuplicates() {
        var repository = mock(ICatalogRepository.class);
        var images = mock(IProductImageRepository.class);
        var catalog = catalog(repository, images);
        String first = urls(1).get(0);

        assertEquals("0002", assertThrows(AppException.class, () -> catalog.create("m", "s", command(urls(9)))).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> catalog.create("m", "s", command(List.of("/media/../../etc/passwd.png")))).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> catalog.create("m", "s", command(List.of(first, first)))).getCode());
        verify(images, never()).replace(anyString(), anyString(), anyList());
        verify(images, never()).insertInitial(anyString(), anyString(), anyList());
        verify(repository, never()).insert(any());
    }

    @Test
    void legacyImageFieldFallsBackOnlyWhenImageListIsAbsent() {
        var repository = mock(ICatalogRepository.class);
        var images = mock(IProductImageRepository.class);
        var catalog = catalog(repository, images);
        String legacy = urls(1).get(0);

        catalog.create("m", "s", new ProductCreateCommandEntity("标题", "描述", "food", legacy, skus(), null));
        verify(images).insertInitial(anyString(), eq("m"), eq(List.of(legacy)));

        // 显式空数组表示“清空相册”，不能再回退旧字段。
        catalog.create("m", "s", new ProductCreateCommandEntity("标题", "描述", "food", legacy, skus(), List.of()));
        verify(images, times(1)).insertInitial(anyString(), eq("m"), eq(List.of()));
    }

    @Test
    void repositoryKeepsOrderAndMarksLocalProvider() throws Exception {
        var dao = mock(ICatalogDao.class);
        when(dao.claimProductImage(anyString(), eq("m"), eq("p"))).thenReturn(1);
        var repository = repository(dao);
        List<String> urls = existingObjects(8);
        var captor = ArgumentCaptor.forClass(ProductImagePO.class);

        repository.replace("p", "m", urls);

        verify(dao).deleteProductImages("p");
        verify(dao, times(8)).insertProductImage(captor.capture());
        List<ProductImagePO> rows = captor.getAllValues();
        for (int i = 0; i < 8; i++) {
            assertEquals(i, rows.get(i).getSortOrder());
            assertEquals("LOCAL", rows.get(i).getProvider());
            assertEquals(urls.get(i), rows.get(i).getUrl());
            assertEquals(urls.get(i).substring("/media/".length()), rows.get(i).getObjectKey());
        }
    }

    @Test
    void repositoryRejectsMissingObjectAndForeignObject() throws Exception {
        var dao = mock(ICatalogDao.class);
        var repository = repository(dao);

        String missing = "/media/" + UUID.randomUUID() + ".png";
        assertEquals("G0001", assertThrows(AppException.class, () -> repository.replace("p", "m", List.of(missing))).getCode());

        // 文件存在，但未由当前商户上传登记：视为越权引用。
        List<String> owned = existingObjects(1);
        when(dao.claimProductImage(anyString(), eq("m"), eq("p"))).thenReturn(0);
        when(dao.productImageClaims("p")).thenReturn(List.of());
        assertEquals("A0006", assertThrows(AppException.class, () -> repository.replace("p", "m", owned)).getCode());
        verify(dao, never()).deleteProductImages(anyString());
    }

    @Test
    void repositoryAcceptsImageAlreadyClaimedBySameProduct() throws Exception {
        var dao = mock(ICatalogDao.class);
        List<String> urls = existingObjects(2);
        when(dao.claimProductImage(anyString(), eq("m"), eq("p"))).thenReturn(0);
        when(dao.productImageClaims("p")).thenReturn(
            urls
                .stream()
                .map(url -> url.substring("/media/".length()))
                .toList()
        );
        var repository = repository(dao);

        repository.replace("p", "m", urls);

        verify(dao).deleteProductImages("p");
        verify(dao, times(2)).insertProductImage(any(ProductImagePO.class));
        verify(dao, never()).registerProductImageUpload(anyString(), anyString());
    }

    @Test
    void repositoryRejectsOverLimitMalformedAndDuplicatedReferences() throws Exception {
        var dao = mock(ICatalogDao.class);
        var repository = repository(dao);
        List<String> duplicate = existingObjects(1);

        assertEquals("0002", assertThrows(AppException.class, () -> repository.replace("p", "m", urls(9))).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> repository.replace("p", "m", List.of("/media/x/../../a.png"))).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> repository.replace("p", "m", List.of(duplicate.get(0), duplicate.get(0)))).getCode());
        verify(dao, never()).deleteProductImages(anyString());
        verify(dao, never()).insertProductImage(any(ProductImagePO.class));
    }

    @Test
    void uploadedObjectIsRegisteredForMerchantAndInvalidBytesAreRejected() throws Exception {
        var dao = mock(ICatalogDao.class);
        when(dao.registerProductImageUpload(anyString(), eq("m"))).thenReturn(1);
        var repository = repository(dao);

        String url = repository.storeImage(png(), "m");
        assertTrue(url.matches("/media/[a-f0-9-]+\\.png"));
        assertTrue(Files.isRegularFile(uploadDir.resolve(url.substring("/media/".length()))));
        verify(dao).registerProductImageUpload(eq(url.substring("/media/".length())), eq("m"));

        assertEquals("AI0004", assertThrows(AppException.class, () -> repository.storeImage("not-an-image".getBytes(), "m")).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> repository.storeImage(png(), " ")).getCode());
    }

    /** 上传登记失败时不能返回可被保存的引用。 */
    @Test
    void uploadedObjectRequiresOwnershipRegistration() throws Exception {
        var dao = mock(ICatalogDao.class);
        when(dao.registerProductImageUpload(anyString(), eq("m"))).thenReturn(0);
        var repository = repository(dao);

        assertThrows(IllegalStateException.class, () -> repository.storeImage(png(), "m"));
    }

    private CatalogServiceImpl catalog(ICatalogRepository repository, IProductImageRepository images) {
        when(repository.categories()).thenReturn(List.of(new CategoryVO("food", "食品", true)));
        return new CatalogServiceImpl(repository, mock(ICatalogQueryRepository.class), images);
    }

    private ProductImageRepository repository(ICatalogDao dao) {
        var repository = new ProductImageRepository();
        ReflectionTestUtils.setField(repository, "dao", dao);
        ReflectionTestUtils.setField(repository, "uploadDir", uploadDir.toString());
        return repository;
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<String>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }

    private ProductCreateCommandEntity command(List<String> imageUrls) {
        return new ProductCreateCommandEntity("标题", "描述", "food", imageUrls.isEmpty() ? "" : imageUrls.get(0), skus(), imageUrls);
    }

    private List<ProductSkuEntity> skus() {
        return List.of(new ProductSkuEntity(UUID.randomUUID().toString(), "默认规格", 100L, "ACTIVE", 0));
    }

    private List<String> urls(int count) {
        return IntStream.range(0, count)
            .mapToObj(i -> "/media/" + UUID.randomUUID() + ".png")
            .toList();
    }

    private List<String> existingObjects(int count) throws Exception {
        List<String> created = new ArrayList<>();
        for (String url : urls(count)) {
            Files.write(uploadDir.resolve(url.substring("/media/".length())), png());
            created.add(url);
        }
        return created;
    }

    private byte[] png() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }
}
