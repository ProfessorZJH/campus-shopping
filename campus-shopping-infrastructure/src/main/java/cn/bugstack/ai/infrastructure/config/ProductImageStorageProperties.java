package cn.bugstack.ai.infrastructure.config;

import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 商品图片存储配置。
 * 默认 LOCAL；只有显式选择 QINIU 才会上传云端。七牛字段按“全空表示未启用、部分填写即启动失败”处理，
 * 避免切换 provider 后静默坏读。下载域名只接受纯 host，地址完全由服务端可信配置构建。
 */
@ConfigurationProperties(prefix = "campus.images")
public class ProductImageStorageProperties {

    /** LOCAL 或 QINIU；大小写不敏感，其他值启动失败。 */
    private String provider = "LOCAL";
    private Qiniu qiniu = new Qiniu();

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public Qiniu getQiniu() {
        return qiniu;
    }

    public void setQiniu(Qiniu qiniu) {
        this.qiniu = qiniu;
    }

    public String normalizedProvider() {
        String value = provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT);
        if (!"LOCAL".equals(value) && !"QINIU".equals(value)) throw new IllegalStateException("商品图片 provider 只允许 LOCAL 或 QINIU");
        return value;
    }

    public boolean qiniuSelected() {
        return "QINIU".equals(normalizedProvider());
    }

    /** 返回配置可用的七牛能力；未启用时返回 false。任何部分配置都直接失败。 */
    public boolean qiniuEnabled() {
        return validateAndEnabled();
    }

    private boolean validateAndEnabled() {
        String accessKey = text(qiniu.accessKey),
            secretKey = text(qiniu.secretKey),
            bucket = text(qiniu.bucket),
            domain = text(qiniu.downloadDomain);
        boolean any = !accessKey.isEmpty() || !secretKey.isEmpty() || !bucket.isEmpty() || !domain.isEmpty();
        if (!any) {
            if (qiniuSelected()) throw new IllegalStateException("已选择 QINIU，但缺少七牛必需配置");
            return false;
        }
        if (accessKey.isEmpty() || secretKey.isEmpty() || bucket.isEmpty() || domain.isEmpty()) {
            throw new IllegalStateException("七牛配置不完整：access-key、secret-key、bucket、download-domain 必须同时配置");
        }
        // 校验与后续调用必须使用同一组规范化值，避免前后空白造成“校验通过但签名用原串”。
        qiniu.accessKey = accessKey;
        qiniu.secretKey = secretKey;
        qiniu.bucket = bucket.toLowerCase(Locale.ROOT);
        qiniu.downloadDomain = domain.toLowerCase(Locale.ROOT);
        if (!qiniu.bucket.matches("[a-z0-9][a-z0-9-]{1,61}[a-z0-9]")) throw new IllegalStateException("七牛 bucket 名称不合法");
        if (!validHost(qiniu.downloadDomain)) throw new IllegalStateException("七牛下载域名必须是纯 host，不能包含协议、账号、路径、query 或 fragment");
        if (qiniu.signatureTtlSeconds < 30 || qiniu.signatureTtlSeconds > 3600) {
            throw new IllegalStateException("七牛下载签名有效期必须在 30–3600 秒");
        }
        // token 首段是 access-key 原文：AK 含 ':' 或换行会让 SDK 自解析 token 失败并在内部打印异常栈。
        if (!accessKey.matches("[A-Za-z0-9_-]+")) throw new IllegalStateException("七牛 access-key 只允许字母、数字、下划线与连字符");
        // secret-key 只作为 HMAC 密钥参与签名，不会原样拼入 token；仅排除空白与换行。
        // 不用正则 .*\s.*：Java 的 . 不跨行，多行字符串会漏检。
        if (secretKey.isEmpty() || secretKey.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalStateException("七牛 secret-key 不得包含空白或换行");
        }
        // SDK 7.19.0 的 autoRegion 会先联网发现区域，失败时在 FormUploader 内部打印异常栈；
        // 因此上传必须显式固定受支持区域，不猜 bucket 所属区域，也不提供 auto。
        qiniu.region = text(qiniu.region);
        boolean fixedRegion = FIXED_REGIONS.contains(qiniu.region);
        if (qiniuSelected() && !fixedRegion) {
            throw new IllegalStateException("已选择 QINIU 上传时必须显式配置 region（z0/z1/z2/na0/as0/cn-east-2），不支持 auto 或留空");
        }
        if (!fixedRegion && !qiniu.region.isEmpty()) {
            throw new IllegalStateException("七牛 region 只支持 z0/z1/z2/na0/as0/cn-east-2，不支持 auto");
        }
        // SDK 7.19.0 的这三个超时字段单位是秒（官方 Configuration 注释），不能传毫秒。
        if (!validTimeout(qiniu.connectTimeoutSeconds) || !validTimeout(qiniu.readTimeoutSeconds) || !validTimeout(qiniu.writeTimeoutSeconds)) {
            throw new IllegalStateException("七牛连接、读取、写入超时必须在 1–60 秒");
        }
        if (qiniu.retryMax < 0 || qiniu.retryMax > 3) throw new IllegalStateException("七牛重试次数必须在 0–3");
        return true;
    }

    /** 显式固定区域：SDK 只有 autoRegion 会联网发现区域，而那条路径会在内部打印异常栈。 */
    private static final java.util.Set<String> FIXED_REGIONS = java.util.Set.of("z0", "z1", "z2", "na0", "as0", "cn-east-2");

    private static boolean validTimeout(int value) {
        return value >= 1 && value <= 60;
    }

    /** 只接受 DNS 域名；IPv4/IPv6、scheme、userinfo、端口、路径、query、fragment 全部拒绝。 */
    static boolean validHost(String value) {
        if (value == null || value.isBlank() || value.length() > 253) return false;
        String host = value.trim();
        return host.matches("([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}");
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    public static class Qiniu {

        private String accessKey = "";
        private String secretKey = "";
        private String bucket = "";
        /** 下载域名，只写 host，例如 cdn.example.com。 */
        private String downloadDomain = "";
        /** 桶默认私有：稳定 URL 经本服务按需签名跳转。 */
        private boolean privateBucket = true;
        /**
         * 本机开发测试例外：允许公有七牛测试域名以明文 HTTP 展示（仅 dev + 回环 + 公有桶 + 测试域名形状）。
         * 默认 false，即正式行为始终 HTTPS；为 true 但条件不符时启动失败。
         */
        private boolean publicHttpDownload = false;
        private long signatureTtlSeconds = 300;
        private int connectTimeoutSeconds = 5;
        private int readTimeoutSeconds = 15;
        private int writeTimeoutSeconds = 15;
        private int retryMax = 2;
        /** 必须显式固定区域（z0/z1/z2/na0/as0/cn-east-2）；不支持 auto，也不默认猜测。 */
        private String region = "";

        public String getAccessKey() {
            return accessKey;
        }

        public void setAccessKey(String accessKey) {
            this.accessKey = accessKey;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getDownloadDomain() {
            return downloadDomain;
        }

        public void setDownloadDomain(String downloadDomain) {
            this.downloadDomain = downloadDomain;
        }

        public boolean isPrivateBucket() {
            return privateBucket;
        }

        public void setPrivateBucket(boolean privateBucket) {
            this.privateBucket = privateBucket;
        }

        public boolean isPublicHttpDownload() {
            return publicHttpDownload;
        }

        public void setPublicHttpDownload(boolean publicHttpDownload) {
            this.publicHttpDownload = publicHttpDownload;
        }

        public long getSignatureTtlSeconds() {
            return signatureTtlSeconds;
        }

        public void setSignatureTtlSeconds(long signatureTtlSeconds) {
            this.signatureTtlSeconds = signatureTtlSeconds;
        }

        public int getConnectTimeoutSeconds() {
            return connectTimeoutSeconds;
        }

        public void setConnectTimeoutSeconds(int connectTimeoutSeconds) {
            this.connectTimeoutSeconds = connectTimeoutSeconds;
        }

        public int getReadTimeoutSeconds() {
            return readTimeoutSeconds;
        }

        public void setReadTimeoutSeconds(int readTimeoutSeconds) {
            this.readTimeoutSeconds = readTimeoutSeconds;
        }

        public int getWriteTimeoutSeconds() {
            return writeTimeoutSeconds;
        }

        public void setWriteTimeoutSeconds(int writeTimeoutSeconds) {
            this.writeTimeoutSeconds = writeTimeoutSeconds;
        }

        public int getRetryMax() {
            return retryMax;
        }

        public void setRetryMax(int retryMax) {
            this.retryMax = retryMax;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }
    }
}
