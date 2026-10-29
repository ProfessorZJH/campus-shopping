package cn.bugstack.ai.config;
import org.springframework.beans.factory.annotation.Value;import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;import java.nio.file.Path;
/** 自托管页面和重新编码后的 PNG 图片；不暴露知识原文件或服务器内部路径。 */
@Configuration
public class WebAssetsConfig implements WebMvcConfigurer {
 @Value("${campus.uploads:./var/uploads}") private String uploads;
 @Override public void addResourceHandlers(ResourceHandlerRegistry registry){registry.addResourceHandler("/media/**").addResourceLocations(directoryUri()).setCachePeriod(86400);}
 private String directoryUri(){
  Path path=Path.of(uploads).toAbsolutePath().normalize();
  try{java.nio.file.Files.createDirectories(path);}catch(java.io.IOException e){throw new IllegalStateException("无法创建商品图片目录",e);}
  String uri=path.toUri().toString();return uri.endsWith("/")?uri:uri+"/";
 }
}
