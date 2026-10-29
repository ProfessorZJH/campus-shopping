package cn.bugstack.ai.domain.catalog.adapter.repository;

/** 商品图片的本地存储端口：负责内容校验和存储，不依赖商品 SQL 仓储。 */
public interface IProductImageRepository {
    /** 将已上传图片重编码为 PNG，仅返回服务允许的 /media URL。 */
    String storeImage(byte[] bytes);
}
