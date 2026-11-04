package cn.bugstack.ai.domain.catalog.model.valobj;

/** 商品图片的可迁移对象引用；URL 仅是当前本地适配器生成的访问投影。 */
public record ProductImageVO(String imageId, String provider, String objectKey, String url, int sortOrder) {}
