package cn.bugstack.ai.domain.catalog.adapter.port;

/**
 * 商品图片云对象下载地址的窄能力。
 * 安全边界是严格规范化的服务端 object_key（由领域值类型校验前缀、UUID 与后缀），不接收客户端任意 URL 或 bucket 域名；
 * 本端口不查询上传登记或商品引用，也不得在此访问业务数据库或代理下载远程字节。
 */
public interface IProductImageMediaPort {
    /** 未配置七牛读取能力时返回 null，由调用方明确失败而不是静默坏读。 */
    String downloadUrl(String objectKey);
}
