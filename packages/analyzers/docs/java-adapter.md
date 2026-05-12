# Java adapter coverage

Source: `src/adapters/java/`. Delegates parsing to a JVM hop — the JAR at
`tools/parser-jars/javaparser-runner.jar` (source under
`tools/parser-jars/javaparser-runner/`) walks the source tree and emits JSON
shaped for the IR. The TS adapter then transforms that JSON.

## Capabilities

| Capability   | Status                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| complexity   | ✓                                                                                                                                                                                                  |
| smells       | ✓ — long method, god class, deep nesting, Spring layer-skip                                                                                                                                        |
| cohesion     | **no** — module-internal calls don't require `import` in Java (same-package refs are implicit), so the import-only metric systemically underreports. Plan to replace with type-reference analysis. |
| coupling     | ✓ — module-level fan-in / fan-out from `import` declarations                                                                                                                                       |
| abstractness | ✓ — counts interfaces + abstract classes + annotations vs total types per module; drives Martin distance                                                                                           |
| duplication  | indirect — jscpd at the orchestrator                                                                                                                                                               |

## Recognized JavaParser declarations

| JavaParser node                           | What we extract                                            | Java example                                                        |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `ClassOrInterfaceDeclaration` (class)     | name, fields, methods, constructors, annotations, heritage | `class PetController { … }`                                         |
| `ClassOrInterfaceDeclaration` (interface) | counted toward abstractness; methods listed                | `interface PetRepository extends JpaRepository<Pet, Long> { }`      |
| `EnumDeclaration`                         | counted as a type; enum constants currently not extracted  | `enum Status { OPEN, CLOSED }`                                      |
| `AnnotationDeclaration`                   | counted as an abstract type                                | `@interface Audit { String value(); }`                              |
| `MethodDeclaration`                       | name, parameters, annotations, abstract flag               | `public void list() { … }`                                          |
| `ConstructorDeclaration`                  | counted as a method                                        | `public PetController(PetService s) { … }`                          |
| `FieldDeclaration`                        | name + annotations                                         | `@Autowired private PetService petService;`                         |
| `ImportDeclaration`                       | source FQN, static/asterisk flags                          | `import com.example.Foo;`, `import static java.util.Collections.*;` |
| `PackageDeclaration`                      | drives module assignment                                   | `package com.example.petclinic.pets;`                               |

## Cyclomatic + nesting

Done in the JAR. Decision nodes that bump complexity by 1:

- `IfStmt`, `WhileStmt`, `DoStmt`, `ForStmt`, `ForEachStmt`, `CatchClause`, `SwitchEntry`, `ConditionalExpr` (ternary)
- Binary boolean ops (`&&`, `||`) — counted via expression walk

Nesting nodes for max-depth:

- `IfStmt`, `WhileStmt`, `DoStmt`, `ForStmt`, `ForEachStmt`, `TryStmt`, `CatchClause`, `SwitchStmt`

## Spring framework rules

`spring/` subpackage classifies each class by layer:

- `@RestController` / `@Controller` → controller
- `@Service` → service
- `@Repository` → repository
- `@Component` → component (generic)
- `@Configuration` → configuration

The `spring-layer-skip` rule flags controllers that wire directly to
repositories without going through a service.

## Module assignment

`moduleNameForPackage(packageName)` uses the last segment of the package as
the module name. For `com.example.petclinic.pets.PetController` the package
is `com.example.petclinic.pets` → module `pets`. Tested for Spring's
canonical `<group>.<artifact>.<feature>` layout.

## Directory excludes

JAR-side `SKIP_DIRS` mirrors the TS-side analyzer:

`.git`, `target`, `build`, `.gradle`, `.idea`, `node_modules`, `.mvn`, `test`,
`tests`, `__tests__`, `fixtures`, `__fixtures__`, `e2e`, `static`, `public`,
`assets`, `resources`, `sample-projects`

After changing the JAR's exclusion set, rebuild via:

```
./tools/.maven/apache-maven-3.9.15/bin/mvn -f tools/parser-jars/javaparser-runner/pom.xml -B clean package
cp tools/parser-jars/javaparser-runner/target/javaparser-runner.jar tools/parser-jars/javaparser-runner.jar
```

## Known gaps

- **Same-package type references are invisible** (no `import` required). Cohesion is therefore disabled. Plan: use JavaParser's `resolve()` to surface every type ref in method bodies/fields.
- Lambda expressions are not counted as separate functions.
- Method references (`Foo::bar`) — invisible.
- Inner classes / anonymous classes — counted, but their members aren't always credited to the right enclosing module.
- Generics: bounded type parameters don't generate edges.
- Reflection / `Class.forName(...)` — invisible.

When you change this adapter or the JAR, update this table.
