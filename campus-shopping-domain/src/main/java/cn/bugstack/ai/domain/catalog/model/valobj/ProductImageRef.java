package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 商品图片的服务端稳定引用。
 * 旧 LOCAL 地址形态与语义保持不变；七牛对象复用同一 /media 前缀，但必须有独立的 qiniu 命名空间，
 * 从而无需查库即可区分 provider。这里只接受服务生成的相对路径，拒绝外链、query、编码绕路和路径穿越。
 */
public record ProductImageRef(String provider, String objectKey, String url) {
    public static final String PROVIDER_LOCAL = "LOCAL";
    public static final String PROVIDER_QINIU = "QINIU";

    /** 旧地址保持原白名单：/media/{合法object_key}.png，不借机收紧历史输入。 */
    private static final Pattern LOCAL = Pattern.compile("^/media/([a-f0-9-]+)\\.png$");
    private static final Pattern QINIU_UUID = Pattern.compile("^/media/qiniu/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\\.png$");

    public ProductImageRef {
        if (provider == null || objectKey == null || url == null) throw new IllegalArgumentException("图片引用不能为空");
    }

    /** 解析客户端提交或数据库中保存的图片地址；非法地址也用于拒绝伪造引用。 */
    public static ProductImageRef of(String url) {
        if (url != null) {
            Matcher qiniu = QINIU_UUID.matcher(url);
            if (qiniu.matches()) return new ProductImageRef(PROVIDER_QINIU, "qiniu/" + qiniu.group(1) + ".png", url);
            Matcher local = LOCAL.matcher(url);
            if (local.matches()) return new ProductImageRef(PROVIDER_LOCAL, local.group(1) + ".png", url);
        }
        throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
    }

    public static boolean accepts(String url) {
        if (url == null) return false;
        return QINIU_UUID.matcher(url).matches() || LOCAL.matcher(url).matches();
    }

    /** 新上传对象使用 UUID 作为对象名，保证可直接从地址推导 object_key。 */
    public static String newObjectName() {
        return UUID.randomUUID() + ".png";
    }

    public static ProductImageRef local(String objectName) {
        ProductImageRef ref = of("/media/" + objectName);
        if (!PROVIDER_LOCAL.equals(ref.provider())) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        return ref;
    }

    public static ProductImageRef qiniu(String objectName) {
        ProductImageRef ref = of("/media/qiniu/" + objectName);
        if (!PROVIDER_QINIU.equals(ref.provider())) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        return ref;
    }

    /** 是否为本地文件对象；LOCAL 仍需复验文件存在，QINIU 只认上传时登记的对象行。 */
    public boolean local() {
        return PROVIDER_LOCAL.equals(provider);
    }
}
