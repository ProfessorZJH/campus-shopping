package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.ProductImagePO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.io.ByteArrayInputStream;
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
 * 商品图片的本地文件存储适配器。
 * 保留原有 2MB / 1200 万像素上限，避免将原始上传字节直接公开为静态文件。
 */
@Repository
public class ProductImageRepository implements IProductImageRepository {

    @Resource
    private ICatalogDao dao;

    @Value("${campus.uploads}")
    private String uploadDir;

    @Override
    public String storeImage(byte[] data) {
        if (data == null || data.length == 0 || data.length > 2 * 1024 * 1024) {
            throw new AppException(ResponseCode.UPLOAD_INVALID);
        }
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new AppException(ResponseCode.UPLOAD_INVALID);
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 12000000L) {
                    throw new AppException(ResponseCode.UPLOAD_INVALID);
                }

                String name = UUID.randomUUID() + ".png";
                Path dir = Path.of(uploadDir).toAbsolutePath().normalize();
                Files.createDirectories(dir);
                if (!ImageIO.write(reader.read(0), "png", dir.resolve(name).toFile())) {
                    throw new IOException("图片编码失败");
                }
                return "/media/" + name;
            } finally {
                reader.dispose();
            }
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
    public void insertInitial(String productId, List<String> urls) {
        insertRows(productId, urls);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void replace(String productId, List<String> urls) {
        dao.deleteProductImages(productId);
        insertRows(productId, urls);
    }

    private void insertRows(String productId, List<String> urls) {
        for (int i = 0; i < urls.size(); i++) {
            String url = urls.get(i);
            String key = url.substring("/media/".length());
            dao.insertProductImage(
                ProductImagePO.builder()
                    .imageId(UUID.randomUUID().toString())
                    .productId(productId)
                    .provider("LOCAL")
                    .objectKey(key)
                    .url(url)
                    .sortOrder(i)
                    .build()
            );
        }
    }

    private ProductImageVO vo(ProductImagePO p) {
        return new ProductImageVO(p.getImageId(), p.getProvider(), p.getObjectKey(), p.getUrl(), p.getSortOrder());
    }
}
