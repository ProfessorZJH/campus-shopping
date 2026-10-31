package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

/** 聚合/PO 映射与本地商品图片存储；图片重编码，不直接公开用户原始文件。 */
@Repository
public class CatalogRepository implements ICatalogRepository {

  @Resource
  private ICatalogDao dao;

  @Resource
  private cn.bugstack.ai.infrastructure.redis.DisplayCache cache;

  public record ProductDisplay(
    String title,
    String description,
    String categoryCode,
    String imageUrl
  ) {}

  public ProductAggregate findForDisplay(String id) {
    ProductPO facts = dao.productFacts(id);
    if (facts == null) return null;
    ProductDisplay display = cache.read(
      "product:" + id + ":" + facts.getVersion(),
      40,
      new com.fasterxml.jackson.core.type.TypeReference<ProductDisplay>() {},
      () -> {
        ProductPO p = dao.product(id, false);
        return p == null
          ? null
          : new ProductDisplay(
              p.getTitle(),
              p.getDescription(),
              p.getCategoryCode(),
              p.getImageUrl()
            );
      }
    );
    if (display == null) return null;
    facts.setTitle(display.title());
    facts.setDescription(display.description());
    facts.setCategoryCode(display.categoryCode());
    facts.setImageUrl(display.imageUrl());
    return aggregate(facts, dao.skus(List.of(id)));
  }

  public List<CategoryVO> displayCategories() {
    return cache.read(
      "categories",
      600,
      new com.fasterxml.jackson.core.type.TypeReference<List<CategoryVO>>() {},
      this::categories
    );
  }

  @Value("${campus.uploads}")
  private String uploadDir;

  public ProductAggregate find(String id, boolean lock) {
    ProductPO p = dao.product(id, lock);
    return p == null ? null : aggregate(p, dao.skus(List.of(id)));
  }

  public void insert(ProductAggregate p) {
    dao.insertProduct(po(p));
    for (ProductSkuEntity s : p.getSkus()) dao.insertSku(sku(p, s));
  }

  public void save(ProductAggregate p) {
    if (dao.saveProduct(po(p)) != 1) throw new AppException(ResponseCode.STATE_CONFLICT);
    cache.evictAfterCommit("product:" + p.getId() + ":" + p.getVersion());
    Set<String> old = new HashSet<>(
      dao.skus(List.of(p.getId())).stream().map(SkuPO::getId).toList()
    );
    for (ProductSkuEntity s : p.getSkus()) {
      if (old.contains(s.id())) dao.saveSku(sku(p, s));
      else dao.insertSku(sku(p, s));
    }
  }

  public List<SkuOfferVO> offers(List<String> ids, boolean lock) {
    if (ids.isEmpty()) return List.of();
    return dao
      .offers(ids, lock)
      .stream()
      .map(p ->
        new SkuOfferVO(
          p.getSkuId(),
          p.getProductId(),
          p.getMerchantId(),
          p.getStoreId(),
          p.getTitle(),
          p.getSpecKey(),
          p.getPriceCent(),
          p.getVersion(),
          p.getProductStatus(),
          p.getSkuStatus(),
          p.getImageUrl(),
          p.getDescription()
        )
      )
      .toList();
  }

  public List<CategoryVO> categories() {
    return dao
      .categories()
      .stream()
      .map(p -> new CategoryVO(p.getCode(), p.getName(), p.getActive()))
      .toList();
  }

  public void category(String c, String n, boolean a) {
    dao.category(c, n, a);
    cache.evictAfterCommit("categories");
  }

  private ProductAggregate aggregate(ProductPO p, List<SkuPO> ss) {
    return new ProductAggregate(
      p.getId(),
      p.getMerchantId(),
      p.getStoreId(),
      p.getTitle(),
      p.getDescription(),
      p.getCategoryCode(),
      p.getImageUrl(),
      p.getStatus(),
      p.getVersion(),
      ss
        .stream()
        .map(s ->
          new ProductSkuEntity(
            s.getId(),
            s.getSpecKey(),
            s.getPriceCent(),
            s.getStatus(),
            s.getVersion()
          )
        )
        .toList()
    );
  }

  private ProductPO po(ProductAggregate p) {
    return ProductPO.builder()
      .id(p.getId())
      .merchantId(p.getMerchantId())
      .storeId(p.getStoreId())
      .title(p.getTitle())
      .description(p.getDescription())
      .categoryCode(p.getCategoryCode())
      .imageUrl(p.getImageUrl())
      .status(p.getStatus())
      .version(p.getVersion())
      .build();
  }

  private SkuPO sku(ProductAggregate p, ProductSkuEntity s) {
    return SkuPO.builder()
      .id(s.id())
      .productId(p.getId())
      .merchantId(p.getMerchantId())
      .storeId(p.getStoreId())
      .specKey(s.specKey())
      .priceCent(s.priceCent())
      .status(s.status())
      .version(s.version())
      .build();
  }

  public String storeImage(byte[] data) {
    if (data == null || data.length == 0 || data.length > 2 * 1024 * 1024) throw new AppException(
      ResponseCode.UPLOAD_INVALID
    );
    try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
      Iterator<ImageReader> rs = ImageIO.getImageReaders(in);
      if (!rs.hasNext()) throw new AppException(ResponseCode.UPLOAD_INVALID);
      ImageReader r = rs.next();
      try {
        r.setInput(in);
        if ((long) r.getWidth(0) * r.getHeight(0) > 12000000L) throw new AppException(
          ResponseCode.UPLOAD_INVALID
        );
        String name = UUID.randomUUID() + ".png";
        Path dir = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        if (!ImageIO.write(r.read(0), "png", dir.resolve(name).toFile())) throw new IOException(
          "图片编码失败"
        );
        return "/media/" + name;
      } finally {
        r.dispose();
      }
    } catch (IOException e) {
      throw new IllegalStateException("商品图片存储失败", e);
    }
  }
}
