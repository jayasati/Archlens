# Node adapter coverage

Source: `src/adapters/node/`. Parses TS, TSX, JS, JSX, MTS, CTS, MJS, CJS via
tree-sitter. Drives the `typescript` and `javascript` languages.

## Capabilities

| Capability   | Status                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| complexity   | ✓                                                                                                                                  |
| smells       | ✓                                                                                                                                  |
| cohesion     | ✓                                                                                                                                  |
| coupling     | ✓                                                                                                                                  |
| abstractness | **no** — TS uses `interface` for structural types (props, options, DTOs); the count overstates OO abstraction. Restricted to Java. |
| duplication  | indirect — jscpd runs at the orchestrator level on raw tokens                                                                      |

## Recognized AST nodes

| tree-sitter node                         | What we extract                                                         | Example                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `import_statement`                       | source specifier + `import type` flag                                   | `import { x } from './foo.js'`                          |
| `export_statement` with string           | treats re-exports as imports for the graph                              | `export { x } from './foo.js'`                          |
| `class_declaration`                      | class with methods, fields, decorators, heritage                        | `class Foo extends Bar { ... }`                         |
| `abstract_class_declaration`             | same as class + `isAbstract: true`                                      | `abstract class Foo { ... }`                            |
| `interface_declaration`                  | name + line range; feeds the abstractness count (Java only consumes it) | `interface PetService { ... }`                          |
| `function_declaration`                   | named function, params, body                                            | `function foo() { ... }`                                |
| `generator_function_declaration`         | same                                                                    | `function* foo() { ... }`                               |
| `lexical_declaration` with arrow         | the dominant modern Node pattern                                        | `const foo = () => { ... }`                             |
| `lexical_declaration` with function      | older expression form                                                   | `const foo = function() { ... }`                        |
| `lexical_declaration` with `call(arrow)` | HOC wrappers (Express asyncHandler, Redux createSlice, React memo)      | `const foo = asyncHandler(async (req, res) => { ... })` |
| `variable_declaration` (`var`)           | same as lexical, var-flavoured                                          |                                                         |

## Inside classes

| Member                                           | Status                                       |
| ------------------------------------------------ | -------------------------------------------- |
| `method_definition`                              | ✓ counted as method                          |
| `public_field_definition` / `property_signature` | name extracted as attribute                  |
| arrow-property fields (`handler = () => {}`)     | **no** — known gap                           |
| static methods                                   | counted (same node type as instance methods) |

## Decorator handling

- Class-level decorators are collected and propagated to inner class/function/method nodes.
- Decorator names are normalised to the trailing identifier (`Controller` for both `@Controller` and `@Controller('users')`).
- Used by the NestJS framework rules in `frameworks/nestjs.ts`.

## Import resolution

`tsconfig-resolver.ts` resolves `./relative.js` and `@scope/workspace-pkg`
imports. Known transformations:

- `.js` / `.mjs` / `.cjs` / `.jsx` extensions rewritten to `.ts` / `.mts` / `.cts` / `.tsx` (TypeScript ESM convention).
- Workspace cross-package imports (`@archlens/shared-types`) probe `<workspace>/src/<subpath>` then `<workspace>/<subpath>`.
- tsconfig `paths` aliases honoured.
- Bare specifiers that don't match a workspace are treated as external (node_modules).

## Known gaps

- Object-literal methods (`{ foo: () => ... }`) at top-level — not counted.
- Class arrow-property methods (`handler = () => ...`) — not counted as methods.
- Deeply nested arrow wrappers (`pipe(map(x => x), filter(y => y))`) — only the first level is considered.
- JSX expression-embedded callbacks — counted as part of the enclosing function, not as separate ones.
- Decorators on non-class members.

When you change this adapter, update this table.
