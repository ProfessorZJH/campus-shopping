package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * 商品图片的本地文件存储适配器。
 * 保留原有 2MB / 1200 万像素上限，避免将原始上传字节直接公开为静态文件。
 */
@Repository
public class ProductImageRepository implements IProductImageRepository {
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
}
