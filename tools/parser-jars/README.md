# tools/parser-jars

Pre-built JARs that the Archlens analyzers shell out to for languages without
a usable WASM tree-sitter grammar (Java) or where semantic resolution is
worth the cost of a JVM hop.

## javaparser-runner.jar

A fat-jar that walks a Java source tree using
[JavaParser](https://javaparser.org/) and emits IR-shaped JSON on stdout.
The TypeScript adapter (`packages/analyzers/src/adapters/java/`) calls this
JAR via `java -jar` and transforms the output into the standard Archlens IR.

### Runtime requirements

- **JDK 11+** on PATH — the JAR is compiled to bytecode target 11 so any
  modern JVM works (Java 21 LTS is what we develop on).
- The JAR is self-contained (JavaParser and Jackson are shaded in).

### Invocation

```bash
java -jar tools/parser-jars/javaparser-runner.jar <repoPath>
```

`stdout` carries a single JSON document; `stderr` carries any logs.
Exit code is `0` on success even if individual files failed to parse —
those filenames appear in the `parseErrors` array of the output.

### Rebuilding the JAR

You rebuild when you change the runner source under
`tools/parser-jars/javaparser-runner/`. The build needs Maven; portable
Maven lives at `tools/.maven/apache-maven-3.9.15/` (gitignored, see below).

```bash
# From repo root
./tools/.maven/apache-maven-3.9.15/bin/mvn -f tools/parser-jars/javaparser-runner/pom.xml -B clean package
cp tools/parser-jars/javaparser-runner/target/javaparser-runner.jar tools/parser-jars/javaparser-runner.jar
```

On Windows PowerShell:

```powershell
& "$PSScriptRoot\..\..\tools\.maven\apache-maven-3.9.15\bin\mvn.cmd" -f tools/parser-jars/javaparser-runner/pom.xml -B clean package
Copy-Item tools/parser-jars/javaparser-runner/target/javaparser-runner.jar tools/parser-jars/javaparser-runner.jar -Force
```

### Bootstrapping Maven (one-time)

The repo ships without a system-wide Maven dependency. If you need to rebuild
the JAR and `tools/.maven/` is missing, fetch portable Maven once:

```bash
mkdir -p tools/.maven
curl -fsSL -o tools/.maven/maven.zip https://dlcdn.apache.org/maven/maven-3/3.9.15/binaries/apache-maven-3.9.15-bin.zip
unzip -q tools/.maven/maven.zip -d tools/.maven
rm tools/.maven/maven.zip
```

The folder is gitignored — every contributor fetches their own copy.

### Output schema (abridged)

```jsonc
{
  "runner": "javaparser-runner",
  "javaparserVersion": "3.26.2",
  "repoRoot": "/abs/path",
  "files": [
    {
      "relPath": "src/main/java/.../Foo.java",
      "packageName": "com.example.foo",
      "loc": 42,
      "imports": [{ "name": "java.util.List", "isStatic": false, "isAsterisk": false, "startLine": 3, "endLine": 3 }],
      "classes": [
        {
          "name": "FooService",
          "kind": "class",
          "isAbstract": false,
          "startLine": 7, "endLine": 60, "loc": 54,
          "annotations": ["Service", "Transactional"],
          "superclass": null,
          "implementsList": ["Foo"],
          "fields": [{ "name": "repo", "type": "FooRepository", "annotations": ["Autowired"] }],
          "methods": [{ "name": "find", "signature": "Foo find(long)", ... "cyclomatic": 3, "cognitive": 2, "maxNestingDepth": 1 }],
          "constructors": [{ ... }]
        }
      ]
    }
  ],
  "parseErrors": []
}
```

Class `kind` is one of `class | interface | enum | annotation`.
