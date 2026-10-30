import com.sun.source.tree.*;
import com.sun.source.util.JavacTask;
import javax.tools.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** 使用真正的 Java 17 语法树建立源码索引；不替代带依赖的 javac 类型检查。 */
public class SourceIndex {
    public static void main(String[] args) throws Exception {
        Path root=Path.of(args[0]);List<Path> files;
        List<Path> found = new ArrayList<>();
        Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
            @Override public FileVisitResult preVisitDirectory(Path dir, java.nio.file.attribute.BasicFileAttributes attrs) {
                return Set.of("target", "node_modules", "var", "artifacts", ".git", ".idea", ".venv", "venv").contains(dir.getFileName().toString())
                    ? FileVisitResult.SKIP_SUBTREE : FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult visitFile(Path p, java.nio.file.attribute.BasicFileAttributes attrs) {
            String path=p.toString().replace('\\','/');
            if (path.contains("/src/") && path.endsWith(".java")) found.add(p);
            return FileVisitResult.CONTINUE;
            }
        });
        files = found;
        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
        try(StandardJavaFileManager manager=compiler.getStandardFileManager(diagnostics,null,StandardCharsets.UTF_8)) {
            JavacTask task=(JavacTask)compiler.getTask(null,manager,diagnostics,List.of("--release","17","-proc:none"),null,manager.getJavaFileObjectsFromPaths(files));
            for(CompilationUnitTree unit:task.parse()) {
                String pkg=unit.getPackageName()==null?"":unit.getPackageName()+".";
                for(Tree t:unit.getTypeDecls()) if(t instanceof ClassTree cls) {
                    String name=pkg+cls.getSimpleName();
                    System.out.println("C|"+name+"|"+cls.getKind()+"|"+cls.getModifiers().getFlags()+"|"+String.join(",",cls.getImplementsClause().stream().map(Object::toString).toList()));
                    for(ImportTree i:unit.getImports()) System.out.println("I|"+name+"|"+i.isStatic()+"|"+i.getQualifiedIdentifier());
                    for(Tree member:cls.getMembers()) {
                        if(member instanceof MethodTree m) System.out.println("M|"+name+"|"+m.getName()+"|"+m.getParameters().size());
                        if(member instanceof VariableTree v) System.out.println("F|"+name+"|"+v.getName()+"|"+v.getType());
                    }
                }
            }
        }
        for(var d:diagnostics.getDiagnostics()) if(d.getKind()==Diagnostic.Kind.ERROR)throw new IllegalStateException(d.toString());
        System.out.println("FILES|"+files.size());
    }
}
