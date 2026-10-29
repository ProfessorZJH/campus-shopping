package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicLong;
/** 单实例的登录/注册入口限流，不相信客户端 X-Forwarded-For；生产多实例需要网关统一限流。 */
public final class AuthenticationRateFilter extends OncePerRequestFilter {
 private final ConcurrentHashMap<String,Window> windows=new ConcurrentHashMap<>();private final AtomicLong cleanup=new AtomicLong();private final ObjectMapper mapper; private final boolean enabled;
 public AuthenticationRateFilter(ObjectMapper mapper){this(mapper,true);}
 public AuthenticationRateFilter(ObjectMapper mapper,boolean enabled){this.mapper=mapper;this.enabled=enabled;}
 @Override protected boolean shouldNotFilter(HttpServletRequest r){return !enabled || !"POST".equals(r.getMethod())||!(r.getRequestURI().equals("/api/v1/auth/login")||r.getRequestURI().equals("/api/v1/auth/register"));}
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  long now=System.currentTimeMillis();if(now-cleanup.get()>60000&&cleanup.getAndSet(now)<now-60000)windows.entrySet().removeIf(e->now-e.getValue().started>300000);
  String key=request.getRemoteAddr()+":"+request.getRequestURI();boolean register=request.getRequestURI().endsWith("register");int limit=register?10:30;long duration=register?300000:60000;
  if(!windows.containsKey(key)&&windows.size()>=10000){reject(response);return;}
  Window w=windows.compute(key,(k,v)->v==null||now-v.started>=duration?new Window(now):v);
  synchronized(w){if(++w.count>limit){reject(response);return;}}
  chain.doFilter(request,response);
 }
 private void reject(HttpServletResponse response)throws IOException{response.setStatus(429);response.setHeader("Retry-After","60");response.setContentType("application/json;charset=UTF-8");mapper.writeValue(response.getWriter(),Response.<Void>builder().code(ResponseCode.AUTH_RATE_LIMITED.getCode()).info(ResponseCode.AUTH_RATE_LIMITED.getInfo()).build());}
 private static final class Window{final long started;int count;Window(long started){this.started=started;}}
}
