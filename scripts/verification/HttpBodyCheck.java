import cn.bugstack.ai.infrastructure.gateway.BoundedHttpBodySubscriber;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** 使用真实 JDK HttpServer/HttpClient 验证生产响应订阅器；不模拟 Spring。 */
public final class HttpBodyCheck {
    static int passed;
    static void check(boolean value,String label){if(!value)throw new AssertionError(label);passed++;System.out.println("PASS "+label);}
    public static void main(String[] args)throws Exception{
        boolean invalid=false;
        try{new BoundedHttpBodySubscriber(0);}catch(IllegalArgumentException e){invalid=true;}
        check(invalid,"拒绝非正数响应上限");
        var executor=Executors.newCachedThreadPool();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.setExecutor(executor);
        server.createContext("/ok",e->{byte[] data="实际HTTP正文".getBytes(StandardCharsets.UTF_8);e.sendResponseHeaders(200,data.length);try(var out=e.getResponseBody()){out.write(data);}});
        server.createContext("/limit",e->{byte[] data=new byte[64];e.sendResponseHeaders(200,data.length);try(var out=e.getResponseBody()){out.write(data);}});
        server.createContext("/over",e->{e.sendResponseHeaders(200,0);try(var out=e.getResponseBody()){out.write(new byte[65]);}});
        server.createContext("/slow",e->{e.sendResponseHeaders(200,0);try(var out=e.getResponseBody()){out.write(1);out.flush();Thread.sleep(1500);out.write(2);}catch(InterruptedException ex){Thread.currentThread().interrupt();}catch(java.io.IOException ignored){/* 客户端按预期超时关闭。 */}});
        server.start();
        try{
            var client=HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(2)).build();
            String url="http://127.0.0.1:"+server.getAddress().getPort();
            var response=client.send(HttpRequest.newBuilder(URI.create(url+"/ok")).build(),i->new BoundedHttpBodySubscriber(64));
            check(new String(response.body(),StandardCharsets.UTF_8).equals("实际HTTP正文"),"真实HTTP完整接收正常正文");
            response=client.send(HttpRequest.newBuilder(URI.create(url+"/limit")).build(),i->new BoundedHttpBodySubscriber(64));
            check(response.body().length==64,"恰好达到上限的正文可接收");
            boolean oversized=false;
            try{client.send(HttpRequest.newBuilder(URI.create(url+"/over")).build(),i->new BoundedHttpBodySubscriber(64));}catch(java.io.IOException expected){oversized=true;}
            check(oversized,"无Content-Length分块正文超限仍被拒绝");
            var pending=client.sendAsync(HttpRequest.newBuilder(URI.create(url+"/slow")).build(),i->new BoundedHttpBodySubscriber(64));
            boolean timeout=false;
            try{pending.get(200,TimeUnit.MILLISECONDS);}catch(TimeoutException expected){timeout=true;}finally{pending.cancel(true);}
            check(timeout,"已收到响应头的慢正文仍受完整响应超时约束");
            check(pending.isDone() && pending.isCompletedExceptionally(),"超时请求已显式取消");
        }finally{server.stop(0);executor.shutdownNow();executor.awaitTermination(3,TimeUnit.SECONDS);}
        System.out.println("CHECKS "+passed);
    }
}