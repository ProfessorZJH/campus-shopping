package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 公开只读目录与发现接口 4 层防爬/防刷盾牌：
 * 1) 恶意爬虫 UA 与标记拦截；
 * 2) 深分页抓取防护（page > 100 或 size > 100）；
 * 3) Penalty-Box 临时封禁 IP 拦截；
 * 4) 校园 NAT 友好突发限流（600 次 / 60s），连续触发 3 次升级 300s 封禁。
 */
public final class PublicAntiCrawlerFilter extends OncePerRequestFilter {

    private static final Pattern MALICIOUS_UA = Pattern.compile("sqlmap|nikto|masscan|zgrab|scrapy|python-urllib/bot", Pattern.CASE_INSENSITIVE);

    private final ObjectMapper mapper;
    private final boolean enabled;
    private final IRequestQuotaRepository quotas;
    private final ICampusRedisPort redisHub;

    public PublicAntiCrawlerFilter(ObjectMapper mapper, boolean enabled, IRequestQuotaRepository quotas, ICampusRedisPort redisHub) {
        this.mapper = mapper;
        this.enabled = enabled;
        this.quotas = quotas;
        this.redisHub = redisHub;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled || !"GET".equals(request.getMethod())) return true;
        String path = RequestPath.applicationPath(request);
        return !(
            path.equals("/api/v1/products") ||
            path.startsWith("/api/v1/products/") ||
            path.equals("/api/v1/merchants/public") ||
            path.startsWith("/api/v1/merchants/public/") ||
            path.equals("/api/v1/discovery") ||
            path.startsWith("/api/v1/discovery/")
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        String ua = request.getHeader("User-Agent");
        String scraperFlag = request.getHeader("X-Scraper-Bot");
        if ("1".equals(scraperFlag) || (ua != null && MALICIOUS_UA.matcher(ua.toLowerCase(Locale.ROOT)).find())) {
            if (redisHub != null) redisHub.recordCrawlerBlocked(ip);
            response.setHeader("Retry-After", "60");
            ApiErrorWriter.write(mapper, response, 429, ResponseCode.AUTH_RATE_LIMITED);
            return;
        }
        if (exceedsPagination(request.getParameter("page"), 100) || exceedsPagination(request.getParameter("size"), 100)) {
            ApiErrorWriter.write(mapper, response, 400, ResponseCode.ILLEGAL_PARAMETER);
            return;
        }
        if (redisHub != null && redisHub.isIpBanned(ip)) {
            response.setHeader("Retry-After", "300");
            ApiErrorWriter.write(mapper, response, 429, ResponseCode.AUTH_RATE_LIMITED);
            return;
        }
        if (quotas != null) {
            long retry;
            try {
                retry = quotas.acquire("public-browse-ip", ip, 600, 60);
            } catch (RuntimeException ignored) {
                // 公开只读浏览在安全 Redis 故障时降级放行，保障展示可用性。
                retry = 0;
            }
            if (retry > 0) {
                long banSeconds = redisHub == null ? 0L : redisHub.recordRateViolationAndMaybeBan(ip);
                response.setHeader("Retry-After", Long.toString(banSeconds > 0 ? banSeconds : retry));
                ApiErrorWriter.write(mapper, response, 429, ResponseCode.AUTH_RATE_LIMITED);
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private static boolean exceedsPagination(String raw, int max) {
        if (raw == null || raw.isBlank()) return false;
        try {
            return Long.parseLong(raw.trim()) > max;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }
}
