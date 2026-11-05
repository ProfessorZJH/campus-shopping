package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.domain.catalog.adapter.port.IProductImageMediaPort;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.config.QiniuPublicHttpPolicy;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.qiniu.common.QiniuException;
import com.qiniu.http.Response;
import com.qiniu.storage.Configuration;
import com.qiniu.storage.DownloadUrl;
import com.qiniu.storage.Region;
import com.qiniu.storage.UploadManager;
import com.qiniu.storage.model.DefaultPutRet;
import com.qiniu.util.Auth;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * 七牛对象存储网关：只负责服务端上传与短期下载地址生成。
 * 固定 SDK 7.19.0、HTTPS 域名、有界超时与重试；不向调用方返回 SDK 异常正文、签名或凭据。
 */
@Service
public class QiniuObjectGateway implements IProductImageMediaPort {

    private static final Logger log = LoggerFactory.getLogger(QiniuObjectGateway.class);
    private static final Pattern OBJECT_KEY = Pattern.compile("^qiniu/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.png$");
    /** 有界等待异步上传结果；先固定 60 秒，后续按配置项收敛。 */
    private static final long UPLOAD_TIMEOUT_SECONDS = 60L;

    private final ProductImageStorageProperties props;
    private final Clock clock;
    private final QiniuPublicHttpPolicy publicHttpPolicy;
    private final boolean configured;
    private final boolean uploadEnabled;
    private final Auth auth;
    // SDK 客户端固定为 final 字段：不继承、不反射改写、不接管全局 stderr。
    private final UploadManager uploadManager;

    @Autowired
    public QiniuObjectGateway(ProductImageStorageProperties props, Clock clock, QiniuPublicHttpPolicy publicHttpPolicy) {
        this(props, clock, null, publicHttpPolicy);
    }

    /** 测试入口：默认关闭本机公开测试模式（HTTPS + 原 CSP）。 */
    public QiniuObjectGateway(ProductImageStorageProperties props, Clock clock) {
        this(props, clock, null, QiniuPublicHttpPolicy.disabled());
    }

    /** 测试入口：允许把 SDK 上传域名指向本地 HTTP stub；生产装配使用上面带策略的构造器。 */
    public QiniuObjectGateway(ProductImageStorageProperties props, Clock clock, Configuration stubConfiguration) {
        this(props, clock, stubConfiguration, QiniuPublicHttpPolicy.disabled());
    }

    QiniuObjectGateway(ProductImageStorageProperties props, Clock clock, Configuration stubConfiguration, QiniuPublicHttpPolicy publicHttpPolicy) {
        this.props = props;
        this.clock = clock;
        this.publicHttpPolicy = publicHttpPolicy == null ? QiniuPublicHttpPolicy.disabled() : publicHttpPolicy;
        this.configured = props.qiniuEnabled();
        this.uploadEnabled = configured && props.qiniuSelected();
        if (configured) {
            ProductImageStorageProperties.Qiniu qiniu = props.getQiniu();
            this.auth = Auth.create(qiniu.getAccessKey(), qiniu.getSecretKey());
            this.uploadManager = uploadEnabled ? new UploadManager(stubConfiguration != null ? stubConfiguration : configuration()) : null;
        } else {
            this.auth = null;
            this.uploadManager = null;
            log.warn("未配置七牛对象存储：/media/qiniu/** 将返回 503；新图片继续使用 LOCAL");
        }
    }

    public boolean configured() {
        return configured;
    }

    public boolean uploadEnabled() {
        return uploadEnabled;
    }

    public String bucket() {
        return props.getQiniu().getBucket();
    }

    /** 上传已在内存中重编码的 PNG；成功返回 object_key，失败只抛出脱敏业务异常。 */
    public String upload(byte[] png, String objectKey) {
        if (!uploadEnabled) throw new IllegalStateException("未启用 QINIU 上传");
        if (png == null || png.length == 0 || !OBJECT_KEY.matcher(objectKey).matches()) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        Response response = null;
        try {
            // 上传凭证限定到确切 object_key，不能复用为其他对象的写入许可。
            String token = auth.uploadToken(props.getQiniu().getBucket(), objectKey);
            response = awaitUpload(png, objectKey, token);
            if (response == null || !response.isOK()) {
                log.warn("七牛图片上传未成功 status={}", response == null ? -1 : response.statusCode);
                throw new AppException(ResponseCode.UN_ERROR);
            }
            // 2xx 也必须核对回执：key 必须与写入对象一致，hash 必须非空，否则视为失败。
            DefaultPutRet putRet = response.jsonToObject(DefaultPutRet.class);
            if (putRet == null || putRet.key == null || !objectKey.equals(putRet.key) || putRet.hash == null || putRet.hash.isBlank()) {
                log.warn("七牛图片上传回执不匹配 key={}", objectKey);
                throw new AppException(ResponseCode.UN_ERROR);
            }
            return objectKey;
        } catch (QiniuException e) {
            // 不记录 SDK 异常正文、请求 URL、签名或凭据。
            log.warn("七牛图片上传失败 status={}", e.code());
            closeQuietly(e.response);
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (AppException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("七牛图片上传异常 type={}", e.getClass().getSimpleName());
            throw new AppException(ResponseCode.UN_ERROR);
        } finally {
            closeQuietly(response);
        }
    }

    /**
     * 用 CompletableFuture 桥接 SDK 的异步上传，替掉同步 put 内部对 Api.Response 的 printStackTrace。
     * 只做一次有界等待：超时、中断、回调异常与启动 IOException 一律转脱敏 AppException，不带 cause 或正文。
     */
    private Response awaitUpload(byte[] png, String objectKey, String token) {
        CompletableFuture<Response> future = new CompletableFuture<>();
        Response resolved = null;
        boolean interrupted = false;
        try {
            uploadManager.asyncPut(png, objectKey, token, null, "image/png", true, (key, response) -> {
                // 只在此处交接 future：重复或迟到响应当场关闭，避免连接泄漏。
                if (!future.complete(response)) closeQuietly(response);
            });
            // 正常返回的 Response 由 upload 现有 finally 关闭，这里不持有副本。
            resolved = future.get(UPLOAD_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return resolved;
        } catch (InterruptedException e) {
            interrupted = true;
            log.warn("七牛图片上传等待被中断");
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (TimeoutException e) {
            log.warn("七牛图片上传等待超时 timeoutSeconds={}", UPLOAD_TIMEOUT_SECONDS);
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (ExecutionException e) {
            // 回调只 complete(Response)，此处是等待环节的防御分支：只记录类型，不记录正文。
            log.warn("七牛图片上传等待失败 type={}", e.getCause() == null ? "null" : e.getCause().getClass().getSimpleName());
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (IOException e) {
            // asyncPut 的启动 IOException（如构建请求失败）；只记录类型，不附 cause 或正文。
            log.warn("七牛图片上传启动失败 type={}", e.getClass().getSimpleName());
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (RuntimeException e) {
            log.warn("七牛图片上传启动异常 type={}", e.getClass().getSimpleName());
            throw new AppException(ResponseCode.UN_ERROR);
        } finally {
            if (resolved == null) {
                // 覆盖超时与其他失败竞争：取消失败说明回调已先行完成，取回迟到响应并关闭。
                if (!future.cancel(false)) {
                    Response late = future.isCompletedExceptionally() || future.isCancelled() ? null : future.getNow(null);
                    if (late != null) closeQuietly(late);
                }
            }
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private static void closeQuietly(Response response) {
        if (response == null) return;
        try {
            response.close();
        } catch (RuntimeException e) {
            log.warn("七牛响应关闭异常 type={}", e.getClass().getSimpleName());
        }
    }

    /** 未配置返回 null；私有桶按当前时间生成短时签名，公有桶返回不带签名的稳定下载地址。 */
    @Override
    public String downloadUrl(String objectKey) {
        if (!configured) return null;
        if (objectKey == null || !OBJECT_KEY.matcher(objectKey).matches()) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        ProductImageStorageProperties.Qiniu qiniu = props.getQiniu();
        // 本机公开测试模式只对公有桶生效，策略层已拒绝私有桶，因此该分支永不生成签名。
        boolean plainHttp = publicHttpPolicy.isEnabled();
        // host 只传纯域名；第二个参数为 false 时生成明文 HTTP 地址（仅本机测试模式）。
        DownloadUrl downloadUrl = new DownloadUrl(qiniu.getDownloadDomain(), !plainHttp, objectKey);
        try {
            if (!qiniu.isPrivateBucket()) {
                String url = downloadUrl.buildURL();
                if (plainHttp && (url.indexOf('?') >= 0 || !url.startsWith("http://" + qiniu.getDownloadDomain() + "/"))) {
                    // 明文测试模式绝不允许带签名/查询串；形状不符直接失败。
                    log.warn("本机公开测试模式生成的下载地址形状不合法");
                    throw new AppException(ResponseCode.UN_ERROR);
                }
                return url;
            }
            long deadline = Instant.now(clock).getEpochSecond() + qiniu.getSignatureTtlSeconds();
            return downloadUrl.buildURL(auth, deadline);
        } catch (QiniuException e) {
            log.warn("七牛图片下载地址生成失败 status={}", e.code());
            throw new AppException(ResponseCode.UN_ERROR);
        } catch (RuntimeException e) {
            log.warn("七牛图片下载地址生成异常 type={}", e.getClass().getSimpleName());
            throw new AppException(ResponseCode.UN_ERROR);
        }
    }

    private Configuration configuration() {
        ProductImageStorageProperties.Qiniu qiniu = props.getQiniu();
        // SDK 7.19.0 的 connect/read/write 超时单位为秒。
        Configuration configuration = Configuration.create(region(qiniu.getRegion()));
        configuration.useHttpsDomains = true;
        configuration.connectTimeout = qiniu.getConnectTimeoutSeconds();
        configuration.readTimeout = qiniu.getReadTimeoutSeconds();
        configuration.writeTimeout = qiniu.getWriteTimeoutSeconds();
        configuration.retryMax = qiniu.getRetryMax();
        // 固定区域未给出上传 host 时直接失败，不回落 SDK 默认 host（避免猜错区域）。
        configuration.useDefaultUpHostIfNone = false;
        return configuration;
    }

    private static Region region(String value) {
        return switch (value) {
            case "z0" -> Region.region0();
            case "z1" -> Region.region1();
            case "z2" -> Region.region2();
            case "na0" -> Region.regionNa0();
            case "as0" -> Region.regionAs0();
            case "cn-east-2" -> Region.regionCnEast2();
            // 不做静默回退：autoRegion 会联网发现区域，失败时 SDK 内部会打印异常栈。
            default -> throw new IllegalStateException("七牛上传必须显式配置受支持的固定 region");
        };
    }
}
