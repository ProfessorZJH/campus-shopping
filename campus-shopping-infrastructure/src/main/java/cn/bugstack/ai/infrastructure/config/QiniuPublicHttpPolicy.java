package cn.bugstack.ai.infrastructure.config;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 七牛公有测试域名的本机开发 HTTP 展示策略。
 *
 * <p>默认关闭；只有显式打开且全部条件成立时才允许以明文 HTTP 生成展示地址，并同步放开 CSP。
 * 网关下载地址与 CSP 必须共用本类，避免两处判断漂移。</p>
 *
 * <p>允许条件（全部满足，缺一即启动失败，不静默降级）：
 * <ol>
 *   <li>开关 {@code campus.images.qiniu.public-http-download} 显式为 true；</li>
 *   <li>有效 profile（active 优先，active 为空回退 default）只有单独的 dev；</li>
 *   <li>{@code server.address} 精确为本机回环字面值（127.0.0.1 或 ::1）；</li>
 *   <li>七牛已启用且 {@code private-bucket=false}（公有桶、无 token）；</li>
 *   <li>下载域名严格匹配七牛公有测试域名形状。</li>
 * </ol>
 *
 * <p>上传始终 HTTPS；本模式只影响下载展示地址与 CSP 的 img-src，且绝不生成签名。</p>
 */
public final class QiniuPublicHttpPolicy {

    /** 本机回环：只接受确定回环字面值（含 IPv6 方括号写法），不接受可解析名称如 localhost。 */
    private static final Set<String> LOOPBACK_HOSTS = Set.of("127.0.0.1", "::1", "[::1]");

    private static final String DEV_PROFILE = "dev";

    /**
     * 七牛公有测试域名形状：{@code <有效标签>.<以 bkt 结尾的地区标签>.clouddn.com}。
     * 地区标签不可省略，因此 {@code <label>.clouddn.com} 不被接受；也不接受 {@code *.qiniudn.com}。
     */
    private static final Pattern TEST_DOMAIN = Pattern.compile("^[a-z0-9]{1,63}\\.[a-z0-9-]{0,58}bkt\\.clouddn\\.com$");

    private final boolean enabled;
    private final String host;
    private final String reason;

    private QiniuPublicHttpPolicy(boolean enabled, String host, String reason) {
        this.enabled = enabled;
        this.host = host;
        this.reason = reason;
    }

    /** 关闭状态：默认行为，与历史完全一致（HTTPS + 原 CSP）。 */
    public static QiniuPublicHttpPolicy disabled() {
        return new QiniuPublicHttpPolicy(false, "", "开关未开启");
    }

    /**
     * 由真实装配调用：开关为 true 时任何条件不满足都抛 {@link IllegalStateException} 让启动失败。
     *
     * <p>profile 判定使用「有效 profile」：显式 active 优先，active 为空才回退 default，
     * 因此 {@code spring.profiles.default=dev} 的常用本机启动不会被误拒。</p>
     *
     * @param switchOn         campus.images.qiniu.public-http-download
     * @param activeProfiles   显式激活 profile
     * @param defaultProfiles  默认 profile（active 为空时生效）
     * @param serverAddress    server.address 原始配置值
     * @param images           图片存储配置
     */
    public static QiniuPublicHttpPolicy resolve(
        boolean switchOn,
        Set<String> activeProfiles,
        Set<String> defaultProfiles,
        String serverAddress,
        ProductImageStorageProperties images
    ) {
        if (!switchOn) return disabled();

        Set<String> effective = activeProfiles == null || activeProfiles.isEmpty() ? (defaultProfiles == null ? Set.of() : defaultProfiles) : activeProfiles;
        // 只接受单独 dev：不接受未配置、多 profile 或与 prod/production 混开。
        // Spring 的 profile 名称区分大小写：只接受真正的 dev，DEV/Dev 等不视为 dev。
        boolean onlyDev = effective.size() == 1 && DEV_PROFILE.equals(effective.iterator().next());
        if (!onlyDev) {
            throw new IllegalStateException("本机公开测试域名模式只允许单独 dev profile（含 spring.profiles.default=dev），不得与其他 profile 混开");
        }
        String address = serverAddress == null ? "" : serverAddress.trim().toLowerCase(Locale.ROOT);
        if (!LOOPBACK_HOSTS.contains(address)) throw new IllegalStateException("本机公开测试域名模式只允许绑定本机回环地址（127.0.0.1 或 ::1）");

        if (images == null || !images.qiniuEnabled()) throw new IllegalStateException("本机公开测试域名模式要求已完整配置七牛");
        ProductImageStorageProperties.Qiniu qiniu = images.getQiniu();
        if (qiniu.isPrivateBucket()) throw new IllegalStateException("本机公开测试域名模式只允许公有桶（private-bucket=false），不得使用签名");

        String host = qiniu.getDownloadDomain();
        if (host == null || !TEST_DOMAIN.matcher(host).matches()) {
            throw new IllegalStateException("本机公开测试域名模式只允许七牛公有测试域名形状（*.clouddn.com 的 bkt 测试域）");
        }
        return new QiniuPublicHttpPolicy(true, host, "本机开发测试模式");
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getHost() {
        return host;
    }

    public String getReason() {
        return reason;
    }

    /** 下载展示地址使用的协议：仅本模式为 http，其余一律 https。 */
    public String downloadScheme() {
        return enabled ? "http" : "https";
    }

    /** CSP img-src 需要追加的来源；未启用时返回空串，保证默认策略逐字不变。 */
    public String cspImageSource() {
        return enabled ? "http://" + host : "";
    }

    /** 供测试与日志使用：不输出凭据与完整 URL。 */
    @Override
    public String toString() {
        return "QiniuPublicHttpPolicy{enabled=" + enabled + ", hostConfigured=" + !host.isEmpty() + "}";
    }
}
