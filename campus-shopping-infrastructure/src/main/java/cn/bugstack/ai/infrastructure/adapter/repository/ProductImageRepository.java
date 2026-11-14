package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageRef;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.ProductImagePO;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 商品图片的对象存储适配器：先真实解码并重编码 PNG，再按配置写入 LOCAL 或七牛。
 * 旧 LOCAL 地址保持原语义；七牛对象使用 /media/qiniu/{uuid}.png 稳定引用，不在商品锁内访问云端。
 */
@Repository
public class ProductImageRepository implements IProductImageRepository {

    @Resource
    private ICatalogDao dao;

    @Resource
    private ProductImageStorageProperties properties;

    @Resource
    private QiniuObjectGateway qiniu;

    @Value("${campus.uploads}")
    private String uploadDir;

    @Override
    public String storeImage(byte[] data, String merchantId) {
        return storeImage(data, merchantId, "PRODUCT");
    }

    /** 商品与门店共用对象存储和归属表，用途在登记时固化，认领时必须匹配。 */
    public String storeImage(byte[] data, String merchantId, String usageType) {
        if (merchantId == null || merchantId.isBlank()) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        if (data == null || data.length == 0 || data.length > 2_000_000) {
            throw new AppException(ResponseCode.UPLOAD_INVALID);
        }
        byte[] png = reencodePng(data);
        String name = ProductImageRef.newObjectName();
        if (properties.qiniuSelected()) {
            // 云端上传在数据库事务与商品锁之外完成；只有上传成功才登记可认领对象。
            String key = qiniu.upload(png, "qiniu/" + name);
            register(key, merchantId, usageType);
            return ProductImageRef.qiniu(name).url();
        }
        writeLocal(png, name);
        register(name, merchantId, usageType);
        return ProductImageRef.local(name).url();
    }

    /** 门店资料只能引用本商户按 STORE 用途上传的图片；仅持有 URL 不能跨商户使用。 */
    public void requireOwnedStoreImage(String merchantId, String imageUrl) {
        ProductImageRef ref = ProductImageRef.of(imageUrl);
        if (ref.local() && !Files.isRegularFile(objectPath(ref.objectKey()))) {
            throw new AppException(ResponseCode.NOT_FOUND);
        }
        if (dao.countImageUpload(ref.objectKey(), merchantId, "STORE") == 0) {
            throw new AppException(ResponseCode.AUTH_FORBIDDEN);
        }
    }

    private void register(String objectKey, String merchantId, String usageType) {
        if (dao.registerProductImageUpload(objectKey, merchantId, usageType) != 1) {
            // 云端对象此时可能成为孤儿；宁可让本次上传失败，也不返回不可认领的地址。
            throw new IllegalStateException("图片对象登记失败");
        }
    }

    private byte[] reencodePng(byte[] data) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw new AppException(ResponseCode.UPLOAD_INVALID);
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 12000000L) {
                    throw new AppException(ResponseCode.UPLOAD_INVALID);
                }
                BufferedImage image = reader.read(0);
                ByteArrayOutputStream png = new ByteArrayOutputStream();
                if (!ImageIO.write(image, "png", png)) throw new IOException("图片编码失败");
                return png.toByteArray();
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new IllegalStateException("商品图片处理失败", e);
        }
    }

    private void writeLocal(byte[] png, String name) {
        try {
            Path dir = uploadDirectory();
            Files.createDirectories(dir);
            Files.write(dir.resolve(name), png);
        } catch (IOException e) {
            throw new IllegalStateException("商品图片存储失败", e);
        }
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public List<ProductImageVO> findAll(String productId) {
        return dao.productImages(productId).stream().map(this::vo).toList();
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public List<ProductImageVO> findAllForUpdate(String productId) {
        return dao.productImagesForUpdate(productId).stream().map(this::vo).toList();
    }

    @Override
    public Map<String, List<ProductImageVO>> findAll(List<String> productIds) {
        List<String> ids = productIds == null ? List.of() : productIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        Map<String, List<ProductImageVO>> grouped = dao
            .productImagesByProducts(ids)
            .stream()
            .collect(Collectors.groupingBy(ProductImagePO::getProductId, LinkedHashMap::new, Collectors.mapping(this::vo, Collectors.toList())));
        Map<String, List<ProductImageVO>> result = new LinkedHashMap<>();
        ids.forEach(id -> result.put(id, grouped.getOrDefault(id, List.of())));
        return result;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void insertInitial(String productId, String merchantId, List<String> urls) {
        insertRows(productId, claimObjects(productId, merchantId, urls));
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void replace(String productId, String merchantId, List<String> urls) {
        List<String> checked = claimObjects(productId, merchantId, urls);
        dao.deleteProductImages(productId);
        insertRows(productId, checked);
    }

    /**
     * 只接受服务生成的图片引用：LOCAL 需文件仍存在，QINIU 只认上传时登记的对象行。
     * 商品事务内不访问云端对象，也不改动历史共享引用。
     */
    private List<String> claimObjects(String productId, String merchantId, List<String> urls) {
        List<String> checked = urls == null ? List.of() : List.copyOf(urls);
        if (checked.size() > 8 || checked.stream().anyMatch(url -> !ProductImageRef.accepts(url)) || checked.stream().distinct().count() != checked.size()) {
            throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        }
        List<ProductImageRef> refs = checked.stream().map(ProductImageRef::of).toList();
        // 认领按对象键稳定排序，避免两个并发编辑以不同相册顺序互相等待。
        for (ProductImageRef ref : refs
            .stream()
            .sorted((a, b) -> a.objectKey().compareTo(b.objectKey()))
            .toList()) {
            if (ref.local() && !Files.isRegularFile(objectPath(ref.objectKey()))) {
                throw new AppException(ResponseCode.NOT_FOUND);
            }
            int claimed = dao.claimProductImage(ref.objectKey(), merchantId, productId);
            if (claimed == 0 && !isAlreadyClaimedByProduct(ref.objectKey(), productId)) {
                throw new AppException(ResponseCode.AUTH_FORBIDDEN);
            }
        }
        return checked;
    }

    private void insertRows(String productId, List<String> urls) {
        for (int i = 0; i < urls.size(); i++) {
            ProductImageRef ref = ProductImageRef.of(urls.get(i));
            dao.insertProductImage(
                ProductImagePO.builder()
                    .imageId(UUID.randomUUID().toString())
                    .productId(productId)
                    .provider(ref.provider())
                    .objectKey(ref.objectKey())
                    .url(ref.url())
                    .sortOrder(i)
                    .build()
            );
        }
    }

    private boolean isAlreadyClaimedByProduct(String objectKey, String productId) {
        return dao.productImageClaims(productId).stream().anyMatch(objectKey::equals);
    }

    private Path objectPath(String objectKey) {
        Path root = uploadDirectory();
        Path candidate = root.resolve(objectKey).normalize();
        return candidate.getParent().equals(root) ? candidate : root.resolve("__invalid__");
    }

    private Path uploadDirectory() {
        return Path.of(uploadDir).toAbsolutePath().normalize();
    }

    private ProductImageVO vo(ProductImagePO p) {
        return new ProductImageVO(p.getImageId(), p.getProvider(), p.getObjectKey(), p.getUrl(), p.getSortOrder());
    }
}
