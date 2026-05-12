# Python adapter coverage

Source: `src/adapters/python/`. Parses `.py` via tree-sitter.

## Capabilities

| Capability   | Status                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| complexity   | ✓                                                                                                                   |
| smells       | ✓                                                                                                                   |
| cohesion     | ✓                                                                                                                   |
| coupling     | ✓                                                                                                                   |
| abstractness | **no** — `abc.ABC` / `typing.Protocol` detection requires inheritance lookup the adapter doesn't perform. Deferred. |
| duplication  | indirect — jscpd at the orchestrator                                                                                |

## Recognized AST nodes

| tree-sitter node            | What we extract                                                  | Example                     |
| --------------------------- | ---------------------------------------------------------------- | --------------------------- |
| `function_definition`       | regular `def foo(args):`                                         | `def get_users(): ...`      |
| `async_function_definition` | `async def`                                                      | `async def fetch(): ...`    |
| `class_definition`          | class with methods and attributes                                | `class UserService:`        |
| `import_statement`          | `import foo[.bar]`                                               | `import os`                 |
| `import_from_statement`     | `from foo[.bar] import x[, y]` with relative level               | `from .utils import helper` |
| `decorated_definition`      | unwraps to underlying class/function so decorators are collected | `@app.route('/users')`      |

## Inside classes

- `function_definition` / `async_function_definition` children → methods
- Attribute names harvested from `__init__` parameter list and `self.x = ...` assignments

## Complexity nodes

`PYTHON_COMPLEXITY` config drives both decision-counting and nesting-tracking:

- decision: `if`, `elif`, `while`, `for`, `except`, `conditional_expression` (ternary), `assert`, `case_clause`, `match_statement`
- nesting: `if`, `elif`, `else`, `while`, `for`, `try`, `with`, `match`
- boolean operators (`and`, `or`) — counted as decisions via `boolean_operator` predicate
- comprehensions (`list_comprehension`, `set_comprehension`, `dictionary_comprehension`, `generator_expression`) — inline `if` clauses count

## Import resolution

`import-resolver.ts` builds an index of `relative-path → dotted-module-name`
and resolves:

- absolute imports against the index
- relative imports (`from . import x`, `from .. import y`) using the source file's dotted prefix
- parent fallback: `from app.routers.users import x` falls back to `app.routers` if the leaf doesn't resolve

## Test file exclusion

In addition to directory excludes (`test/`, `tests/`, `__tests__/`, `fixtures/`, etc.), individual files are skipped:

- `test_*.py`
- `*_test.py`
- `conftest.py`

## Known gaps

- Inheritance graph not analysed — abstractness/Martin distance disabled.
- `exec()` / `eval()` / dynamic imports — invisible.
- Conditional imports (`if PY3: import urllib.parse as urlparse`) — only the first branch is parsed.
- Module-level expression statements that call functions — not counted as anything.
- Type-annotation-only references — not edges (they're just strings until runtime).

When you change this adapter, update this table.
