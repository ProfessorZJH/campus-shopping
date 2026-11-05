package cn.bugstack.ai.config;

import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 媒体资产入口：把稳定的 /media/qiniu/{uuid}.png 引用投影为短时下载地址。
 * 属于页面资源投影，不是 Response&lt;DTO&gt; 业务 API；域外地址只由服务端配置的下载域名生成。
 * 日志只记录业务码或异常类型，不输出 URL、签名、凭据或下游异常正文。
 */
@RestController
public class MediaAssetController {

    private static final Logger log = LoggerFactory.getLogger(MediaAssetController.class);

    private final ICatalogService catalog;

    public MediaAssetController(ICatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/media/qiniu/{filename}")
    public ResponseEntity<Void> qiniu(@PathVariable String filename) {
        String location;
        try {
            location = catalog.productImageDownloadUrl("/media/qiniu/" + filename);
        } catch (AppException e) {
            // 非法引用返回 404；不据此声称对象是否存在，也不用于防枚举。
            if (ResponseCode.ILLEGAL_PARAMETER.getCode().equals(e.getCode())) {
                log.warn("媒体资产引用被拒绝 code={}", e.getCode());
                return noStore(HttpStatus.NOT_FOUND, null);
            }
            log.warn("媒体资产运行故障 code={}", e.getCode());
            return noStore(HttpStatus.SERVICE_UNAVAILABLE, null);
        } catch (RuntimeException e) {
            log.warn("媒体资产解析异常 type={}", e.getClass().getSimpleName());
            return noStore(HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        if (location == null) {
            log.warn("媒体资产未配置云端读取能力");
            return noStore(HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        return noStore(HttpStatus.FOUND, location);
    }

    private static ResponseEntity<Void> noStore(HttpStatus status, String location) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (location != null) builder.header(HttpHeaders.LOCATION, location);
        return builder.build();
    }
}
