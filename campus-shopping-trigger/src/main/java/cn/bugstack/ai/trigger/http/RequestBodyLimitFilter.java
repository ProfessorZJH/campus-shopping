package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** 对 JSON/base64 上传设置读取上限，同时限制未知 Content-Length 的分块请求。 */
public final class RequestBodyLimitFilter extends OncePerRequestFilter {

    public static final long MAX_BODY_BYTES = 3_000_000L;
    private final ObjectMapper mapper;

    public RequestBodyLimitFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public static final class PayloadTooLargeException extends IOException {

        public PayloadTooLargeException() {
            super("请求体超过允许大小");
        }
    }

    static boolean isTooLarge(Throwable exception) {
        for (int depth = 0; exception != null && depth < 20; depth++, exception = exception.getCause()) if (
            exception instanceof PayloadTooLargeException
        ) return true;
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest r, HttpServletResponse p, FilterChain c) throws IOException, ServletException {
        if (r.getContentLengthLong() > MAX_BODY_BYTES) {
            ApiErrorWriter.write(mapper, p, 413, ResponseCode.REQUEST_TOO_LARGE);
            return;
        }
        try {
            c.doFilter(
                new HttpServletRequestWrapper(r) {
                    private ServletInputStream stream;

                    @Override
                    public ServletInputStream getInputStream() throws IOException {
                        if (stream == null) {
                            ServletInputStream delegate = super.getInputStream();
                            stream = new ServletInputStream() {
                                long count;

                                public int read() throws IOException {
                                    if (count > MAX_BODY_BYTES) throw new PayloadTooLargeException();
                                    int v = delegate.read();
                                    if (v >= 0 && ++count > MAX_BODY_BYTES) throw new PayloadTooLargeException();
                                    return v;
                                }

                                public int read(byte[] b, int off, int len) throws IOException {
                                    if (count > MAX_BODY_BYTES) throw new PayloadTooLargeException();
                                    int n = delegate.read(b, off, (int) Math.min(len, MAX_BODY_BYTES - count + 1));
                                    if (n > 0 && (count += n) > MAX_BODY_BYTES) throw new PayloadTooLargeException();
                                    return n;
                                }

                                public boolean isFinished() {
                                    return delegate.isFinished();
                                }

                                public boolean isReady() {
                                    return delegate.isReady();
                                }

                                public void setReadListener(ReadListener l) {
                                    delegate.setReadListener(l);
                                }
                            };
                        }
                        return stream;
                    }

                    @Override
                    public BufferedReader getReader() throws IOException {
                        return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
                    }
                },
                p
            );
        } catch (IOException | ServletException e) {
            if (!p.isCommitted() && isTooLarge(e)) ApiErrorWriter.write(mapper, p, 413, ResponseCode.REQUEST_TOO_LARGE);
            else throw e;
        }
    }
}
