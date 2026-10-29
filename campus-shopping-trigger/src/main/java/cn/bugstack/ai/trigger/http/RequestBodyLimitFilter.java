package cn.bugstack.ai.trigger.http;
import jakarta.servlet.*;import jakarta.servlet.http.*;import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
/** 对 JSON/base64 上传设置读取上限，同时限制未知 Content-Length 的分块请求。 */
public final class RequestBodyLimitFilter extends OncePerRequestFilter {
 private static final long LIMIT=3_000_000L;
 @Override protected void doFilterInternal(HttpServletRequest r,HttpServletResponse p,FilterChain c)throws IOException,ServletException{
  if(r.getContentLengthLong()>LIMIT){p.sendError(413,"请求体过大");return;}
  c.doFilter(new HttpServletRequestWrapper(r){
   private ServletInputStream stream;
   @Override public ServletInputStream getInputStream()throws IOException{
    if(stream==null){ServletInputStream delegate=super.getInputStream();stream=new ServletInputStream(){long count;
     public int read()throws IOException{int v=delegate.read();if(v>=0&&++count>LIMIT)throw new IOException("请求体超过允许大小");return v;}
     public int read(byte[] b,int off,int len)throws IOException{int n=delegate.read(b,off,(int)Math.min(len,LIMIT-count+1));if(n>0&&(count+=n)>LIMIT)throw new IOException("请求体超过允许大小");return n;}
     public boolean isFinished(){return delegate.isFinished();}public boolean isReady(){return delegate.isReady();}public void setReadListener(ReadListener l){delegate.setReadListener(l);}
    };}return stream;
   }
   @Override public BufferedReader getReader()throws IOException{return new BufferedReader(new InputStreamReader(getInputStream(),java.nio.charset.StandardCharsets.UTF_8));}
  },p);
 }
}
