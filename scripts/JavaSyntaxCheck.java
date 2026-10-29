import com.sun.source.util.JavacTask;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;

/** 只检查 Java 17 语法，不解析三方依赖，不代替 Maven 编译。 */
public class JavaSyntaxCheck {
    public static void main(String[] args) throws Exception {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("需要安装 JDK");
        Path root = Path.of(args[0]);
        List<Path> files;
        try (var walk = Files.walk(root)) {
            files = walk.filter(p -> p.toString().endsWith(".java") && p.toString().contains("/src/"))
                    .filter(p -> !p.toString().contains("/target/")).toList();
        }
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, null, java.nio.charset.StandardCharsets.UTF_8)) {
            JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics,
                    List.of("--release", "17", "-proc:none"), null, manager.getJavaFileObjectsFromPaths(files));
            task.parse();
            boolean bad = diagnostics.getDiagnostics().stream().anyMatch(d -> d.getKind() == Diagnostic.Kind.ERROR);
            diagnostics.getDiagnostics().forEach(System.out::println);
            if (bad) throw new IllegalStateException("Java 语法检查失败");
            System.out.println("Java 17 语法解析通过：" + files.size() + " 个源文件（未检查依赖类型）");
        }
    }
}
