package cn.bugstack.ai.domain.catalog.model.valobj;

/** 商品图片的可迁移对象引用；URL 是服务端生成的访问投影（旧 LOCAL 或七牛稳定引用）。 */
public record ProductImageVO(String imageId, String provider, String objectKey, String url, int sortOrder) {}
