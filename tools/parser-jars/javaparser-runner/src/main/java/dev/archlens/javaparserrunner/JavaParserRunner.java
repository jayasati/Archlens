package dev.archlens.javaparserrunner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.ImportDeclaration;
import com.github.javaparser.ast.Modifier;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.NodeList;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.AnnotationExpr;
import com.github.javaparser.ast.stmt.BlockStmt;
import com.github.javaparser.ast.stmt.CatchClause;
import com.github.javaparser.ast.stmt.DoStmt;
import com.github.javaparser.ast.stmt.ForEachStmt;
import com.github.javaparser.ast.stmt.ForStmt;
import com.github.javaparser.ast.stmt.IfStmt;
import com.github.javaparser.ast.stmt.SwitchEntry;
import com.github.javaparser.ast.stmt.SwitchStmt;
import com.github.javaparser.ast.stmt.TryStmt;
import com.github.javaparser.ast.stmt.WhileStmt;
import com.github.javaparser.ast.expr.BinaryExpr;
import com.github.javaparser.ast.expr.ConditionalExpr;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Walks a Java source root and emits a single JSON document on stdout shaped
 * to match the Archlens IR. Logs go to stderr so stdout stays clean.
 */
public final class JavaParserRunner {

  private static final Set<String> SKIP_DIRS = new HashSet<>();
  static {
    SKIP_DIRS.add(".git");
    SKIP_DIRS.add("target");
    SKIP_DIRS.add("build");
    SKIP_DIRS.add(".gradle");
    SKIP_DIRS.add(".idea");
    SKIP_DIRS.add("node_modules");
    SKIP_DIRS.add(".mvn");
    SKIP_DIRS.add("test");
    SKIP_DIRS.add("tests");
    SKIP_DIRS.add("__tests__");
    SKIP_DIRS.add("fixtures");
    SKIP_DIRS.add("__fixtures__");
    SKIP_DIRS.add("e2e");
    SKIP_DIRS.add("static");
    SKIP_DIRS.add("public");
    SKIP_DIRS.add("assets");
    SKIP_DIRS.add("resources");
    SKIP_DIRS.add("sample-projects");
  }

  public static void main(String[] args) throws Exception {
    if (args.length < 1) {
      System.err.println("Usage: java -jar javaparser-runner.jar <repoPath>");
      System.exit(2);
    }
    Path repoRoot = Paths.get(args[0]).toAbsolutePath().normalize();
    if (!Files.isDirectory(repoRoot)) {
      System.err.println("Not a directory: " + repoRoot);
      System.exit(2);
    }

    JavaParser parser = new JavaParser();
    List<ParsedFile> parsedFiles = new ArrayList<>();
    List<String> parseErrors = new ArrayList<>();

    Files.walkFileTree(repoRoot, new SimpleFileVisitor<Path>() {
      @Override public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
        if (dir.equals(repoRoot)) return FileVisitResult.CONTINUE;
        String name = dir.getFileName().toString();
        if (name.startsWith(".") || SKIP_DIRS.contains(name)) return FileVisitResult.SKIP_SUBTREE;
        return FileVisitResult.CONTINUE;
      }
      @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
        if (!file.getFileName().toString().endsWith(".java")) return FileVisitResult.CONTINUE;
        try {
          String src = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
          ParseResult<CompilationUnit> result = parser.parse(src);
          if (result.getResult().isPresent()) {
            ParsedFile pf = transform(repoRoot, file, src, result.getResult().get());
            parsedFiles.add(pf);
          } else {
            parseErrors.add(repoRoot.relativize(file).toString());
          }
        } catch (IOException e) {
          parseErrors.add(repoRoot.relativize(file).toString() + ": " + e.getMessage());
        }
        return FileVisitResult.CONTINUE;
      }
    });

    Map<String, Object> output = new LinkedHashMap<>();
    output.put("runner", "javaparser-runner");
    output.put("javaparserVersion", "3.26.2");
    output.put("repoRoot", repoRoot.toString().replace('\\', '/'));
    output.put("files", parsedFiles);
    output.put("parseErrors", parseErrors);

    ObjectMapper mapper = new ObjectMapper();
    PrintStream out = new PrintStream(System.out, false, "UTF-8");
    mapper.writeValue(out, output);
    out.flush();
  }

  private static ParsedFile transform(Path repoRoot, Path absFile, String src, CompilationUnit cu) {
    ParsedFile pf = new ParsedFile();
    pf.relPath = repoRoot.relativize(absFile).toString().replace('\\', '/');
    pf.loc = countLoc(src);
    pf.packageName = cu.getPackageDeclaration().map(p -> p.getNameAsString()).orElse("");

    for (ImportDeclaration imp : cu.getImports()) {
      ParsedImport pi = new ParsedImport();
      pi.name = imp.getNameAsString();
      pi.isStatic = imp.isStatic();
      pi.isAsterisk = imp.isAsterisk();
      pi.startLine = imp.getBegin().map(p -> p.line).orElse(0);
      pi.endLine = imp.getEnd().map(p -> p.line).orElse(0);
      pf.imports.add(pi);
    }

    for (TypeDeclaration<?> td : cu.getTypes()) {
      if (td instanceof ClassOrInterfaceDeclaration) {
        pf.classes.add(transformClass((ClassOrInterfaceDeclaration) td));
      } else if (td instanceof EnumDeclaration) {
        pf.classes.add(transformEnum((EnumDeclaration) td));
      } else if (td instanceof AnnotationDeclaration) {
        pf.classes.add(transformAnnotationType((AnnotationDeclaration) td));
      }
    }
    return pf;
  }

  private static ParsedClass transformClass(ClassOrInterfaceDeclaration decl) {
    ParsedClass pc = new ParsedClass();
    pc.name = decl.getNameAsString();
    pc.kind = decl.isInterface() ? "interface" : "class";
    pc.isAbstract = decl.isAbstract();
    pc.startLine = decl.getBegin().map(p -> p.line).orElse(0);
    pc.endLine = decl.getEnd().map(p -> p.line).orElse(0);
    pc.loc = pc.endLine - pc.startLine + 1;
    pc.annotations = collectAnnotations(decl.getAnnotations());
    pc.superclass = decl.getExtendedTypes().isEmpty()
        ? null : decl.getExtendedTypes().get(0).getNameAsString();
    for (com.github.javaparser.ast.type.ClassOrInterfaceType t : decl.getImplementedTypes()) {
      pc.implementsList.add(t.getNameAsString());
    }
    for (FieldDeclaration field : decl.getFields()) {
      List<String> fieldAnnotations = collectAnnotations(field.getAnnotations());
      String typeName = field.getElementType().asString();
      for (VariableDeclarator v : field.getVariables()) {
        ParsedField pf = new ParsedField();
        pf.name = v.getNameAsString();
        pf.type = typeName;
        pf.annotations = fieldAnnotations;
        pc.fields.add(pf);
      }
    }
    for (ConstructorDeclaration ctor : decl.getConstructors()) {
      pc.constructors.add(transformConstructor(ctor));
    }
    for (MethodDeclaration m : decl.getMethods()) {
      pc.methods.add(transformMethod(m));
    }
    return pc;
  }

  private static ParsedClass transformEnum(EnumDeclaration decl) {
    ParsedClass pc = new ParsedClass();
    pc.name = decl.getNameAsString();
    pc.kind = "enum";
    pc.startLine = decl.getBegin().map(p -> p.line).orElse(0);
    pc.endLine = decl.getEnd().map(p -> p.line).orElse(0);
    pc.loc = pc.endLine - pc.startLine + 1;
    pc.annotations = collectAnnotations(decl.getAnnotations());
    for (MethodDeclaration m : decl.getMethods()) {
      pc.methods.add(transformMethod(m));
    }
    return pc;
  }

  private static ParsedClass transformAnnotationType(AnnotationDeclaration decl) {
    ParsedClass pc = new ParsedClass();
    pc.name = decl.getNameAsString();
    pc.kind = "annotation";
    pc.startLine = decl.getBegin().map(p -> p.line).orElse(0);
    pc.endLine = decl.getEnd().map(p -> p.line).orElse(0);
    pc.loc = pc.endLine - pc.startLine + 1;
    pc.annotations = collectAnnotations(decl.getAnnotations());
    return pc;
  }

  private static ParsedMethod transformMethod(MethodDeclaration m) {
    ParsedMethod pm = new ParsedMethod();
    pm.name = m.getNameAsString();
    pm.signature = m.getDeclarationAsString(false, false, false);
    pm.startLine = m.getBegin().map(p -> p.line).orElse(0);
    pm.endLine = m.getEnd().map(p -> p.line).orElse(0);
    pm.loc = pm.endLine - pm.startLine + 1;
    pm.annotations = collectAnnotations(m.getAnnotations());
    pm.isAbstract = m.isAbstract();
    pm.isStatic = m.isStatic();
    for (Parameter p : m.getParameters()) {
      ParsedParameter pp = new ParsedParameter();
      pp.name = p.getNameAsString();
      pp.type = p.getType().asString();
      pp.annotations = collectAnnotations(p.getAnnotations());
      pm.parameters.add(pp);
    }
    Optional<BlockStmt> body = m.getBody();
    if (body.isPresent()) {
      Complexity c = computeComplexity(body.get());
      pm.cyclomatic = c.cyclomatic;
      pm.cognitive = c.cognitive;
      pm.maxNestingDepth = c.maxDepth;
    } else {
      pm.cyclomatic = 1;
      pm.cognitive = 0;
      pm.maxNestingDepth = 0;
    }
    return pm;
  }

  private static ParsedMethod transformConstructor(ConstructorDeclaration ctor) {
    ParsedMethod pm = new ParsedMethod();
    pm.name = ctor.getNameAsString();
    pm.signature = ctor.getDeclarationAsString(false, false, false);
    pm.isConstructor = true;
    pm.startLine = ctor.getBegin().map(p -> p.line).orElse(0);
    pm.endLine = ctor.getEnd().map(p -> p.line).orElse(0);
    pm.loc = pm.endLine - pm.startLine + 1;
    pm.annotations = collectAnnotations(ctor.getAnnotations());
    for (Parameter p : ctor.getParameters()) {
      ParsedParameter pp = new ParsedParameter();
      pp.name = p.getNameAsString();
      pp.type = p.getType().asString();
      pp.annotations = collectAnnotations(p.getAnnotations());
      pm.parameters.add(pp);
    }
    Complexity c = computeComplexity(ctor.getBody());
    pm.cyclomatic = c.cyclomatic;
    pm.cognitive = c.cognitive;
    pm.maxNestingDepth = c.maxDepth;
    return pm;
  }

  private static List<String> collectAnnotations(NodeList<AnnotationExpr> annotations) {
    List<String> out = new ArrayList<>();
    for (AnnotationExpr a : annotations) out.add(a.getNameAsString());
    return out;
  }

  private static final class Complexity {
    int cyclomatic = 1;
    int cognitive = 0;
    int maxDepth = 0;
  }

  /**
   * Cyclomatic + cognitive complexity + max nesting depth. Walks the AST
   * counting decision and nesting nodes — same shape as the Python/Node
   * computeComplexity in the TS side.
   */
  private static Complexity computeComplexity(Node root) {
    Complexity c = new Complexity();
    walk(root, 0, 0, c);
    return c;
  }

  private static void walk(Node node, int depth, int nesting, Complexity c) {
    boolean isDecision = false;
    boolean isNesting = false;

    if (node instanceof IfStmt) {
      c.cyclomatic++;
      c.cognitive += 1 + nesting;
      isDecision = true; isNesting = true;
    } else if (node instanceof WhileStmt || node instanceof DoStmt
        || node instanceof ForStmt || node instanceof ForEachStmt) {
      c.cyclomatic++;
      c.cognitive += 1 + nesting;
      isDecision = true; isNesting = true;
    } else if (node instanceof CatchClause) {
      c.cyclomatic++;
      c.cognitive += 1 + nesting;
      isNesting = true;
    } else if (node instanceof TryStmt) {
      isNesting = true;
    } else if (node instanceof SwitchStmt) {
      isNesting = true;
    } else if (node instanceof SwitchEntry) {
      SwitchEntry e = (SwitchEntry) node;
      if (!e.getLabels().isEmpty()) {
        c.cyclomatic++;
        c.cognitive += 1;
      }
    } else if (node instanceof ConditionalExpr) {
      c.cyclomatic++;
      c.cognitive += 1 + nesting;
    } else if (node instanceof BinaryExpr) {
      BinaryExpr be = (BinaryExpr) node;
      if (be.getOperator() == BinaryExpr.Operator.AND || be.getOperator() == BinaryExpr.Operator.OR) {
        c.cyclomatic++;
        c.cognitive++;
      }
    }

    int nextDepth = isNesting ? depth + 1 : depth;
    int nextNesting = isNesting ? nesting + 1 : nesting;
    if (nextDepth > c.maxDepth) c.maxDepth = nextDepth;

    for (Node child : node.getChildNodes()) {
      walk(child, nextDepth, nextNesting, c);
    }
  }

  private static int countLoc(String src) {
    int count = 0;
    boolean inBlock = false;
    for (String raw : src.split("\\r?\\n")) {
      String line = raw.trim();
      if (line.isEmpty()) continue;
      if (inBlock) {
        int end = line.indexOf("*/");
        if (end >= 0) {
          inBlock = false;
          line = line.substring(end + 2).trim();
          if (line.isEmpty()) continue;
        } else {
          continue;
        }
      }
      if (line.startsWith("//")) continue;
      if (line.startsWith("/*")) {
        int end = line.indexOf("*/", 2);
        if (end < 0) { inBlock = true; continue; }
        line = line.substring(end + 2).trim();
        if (line.isEmpty()) continue;
      }
      count++;
    }
    return count;
  }

  // ----- DTOs ----------------------------------------------------------
  // Public fields so Jackson serializes without annotations.

  public static class ParsedFile {
    public String relPath;
    public String packageName;
    public int loc;
    public List<ParsedImport> imports = new ArrayList<>();
    public List<ParsedClass> classes = new ArrayList<>();
  }
  public static class ParsedImport {
    public String name;
    public boolean isStatic;
    public boolean isAsterisk;
    public int startLine;
    public int endLine;
  }
  public static class ParsedClass {
    public String name;
    public String kind;            // class | interface | enum | annotation
    public boolean isAbstract;
    public int startLine;
    public int endLine;
    public int loc;
    public List<String> annotations = new ArrayList<>();
    public String superclass;
    public List<String> implementsList = new ArrayList<>();
    public List<ParsedField> fields = new ArrayList<>();
    public List<ParsedMethod> methods = new ArrayList<>();
    public List<ParsedMethod> constructors = new ArrayList<>();
  }
  public static class ParsedField {
    public String name;
    public String type;
    public List<String> annotations = new ArrayList<>();
  }
  public static class ParsedMethod {
    public String name;
    public String signature;
    public boolean isConstructor;
    public boolean isAbstract;
    public boolean isStatic;
    public int startLine;
    public int endLine;
    public int loc;
    public int cyclomatic;
    public int cognitive;
    public int maxNestingDepth;
    public List<String> annotations = new ArrayList<>();
    public List<ParsedParameter> parameters = new ArrayList<>();
  }
  public static class ParsedParameter {
    public String name;
    public String type;
    public List<String> annotations = new ArrayList<>();
  }
}
