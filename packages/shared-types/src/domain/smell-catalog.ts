import type { Language, Severity } from '@archlens/ir-schema';

export type SmellCategory =
  | 'size'
  | 'complexity'
  | 'design'
  | 'duplication'
  | 'coupling'
  | 'cohesion';

export interface SmellThresholdSpec {
  name: string;
  description: string;
  defaultValue: number | string;
}

export interface SmellDefinitionDto {
  /** Stable identifier emitted as `Smell.ruleId`. Never change once shipped. */
  ruleId: string;
  /** Logical group emitted as `Smell.kind`. Often equal to ruleId today. */
  kind: string;
  /** Human-readable label, e.g. "God class". */
  name: string;
  /** One-sentence summary for table rows. */
  shortDescription: string;
  /** A paragraph explaining why this is a problem and how the rule decides. */
  description: string;
  category: SmellCategory;
  /** Severity emitted by the detector when bare-minimum thresholds are crossed. */
  defaultSeverity: Severity;
  /**
   * Languages the detector currently supports. Use 'all' when the detector
   * is language-agnostic (e.g., size-based rules that work on any IR file).
   */
  languages: ReadonlyArray<Language | 'all'>;
  /** Short suggestion for fixing the smell. */
  remediation: string;
  /** Knobs documented for users; values come from analyzer config defaults. */
  thresholds?: ReadonlyArray<SmellThresholdSpec>;
}

/**
 * Single source of truth for every smell rule the platform can detect.
 *
 * To add a new smell:
 *   1. Append a definition here.
 *   2. Build the detector in `packages/analyzers/src/metrics/smells/`,
 *      importing its `ruleId`/`kind` from this catalog (use the helper
 *      below) so the runtime emission stays in lock-step with the docs.
 *   3. Wire the detector into the worker pipeline.
 *
 * The /smells page in the web app fetches this list at request time, so
 * additions appear in the UI automatically — no further frontend work.
 */
export const SMELL_CATALOG: ReadonlyArray<SmellDefinitionDto> = [
  {
    ruleId: 'god-class',
    kind: 'god-class',
    name: 'God class',
    shortDescription: 'A class with too many responsibilities or too much code.',
    description:
      'Flags classes that exceed configurable size or method-count thresholds. ' +
      'God classes accumulate unrelated concerns, become hard to test, and slow ' +
      'down change because a single edit risks breaking many features.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Split the class along its responsibilities. Move methods clustered ' +
      'around a shared field group into their own collaborator.',
    thresholds: [
      {
        name: 'methods',
        description: 'Method count beyond which a class is suspect.',
        defaultValue: 20,
      },
      {
        name: 'loc',
        description: 'Lines of code beyond which a class is suspect.',
        defaultValue: 400,
      },
    ],
  },
  {
    ruleId: 'long-method',
    kind: 'long-method',
    name: 'Long method',
    shortDescription: 'A function that is too long or too cyclomatically complex.',
    description:
      'Methods past a length or cyclomatic-complexity budget hide intent and are ' +
      'painful to test. The detector inspects every function and method and emits ' +
      'a smell when either threshold is crossed.',
    category: 'size',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Extract sub-routines for cohesive blocks. Replace nested conditionals with ' +
      'guard clauses or polymorphism.',
    thresholds: [
      {
        name: 'loc',
        description: 'Lines of code beyond which a method is suspect.',
        defaultValue: 50,
      },
      {
        name: 'complexity',
        description: 'Cyclomatic complexity beyond which a method is suspect.',
        defaultValue: 10,
      },
    ],
  },
  {
    ruleId: 'deep-nesting',
    kind: 'deep-nesting',
    name: 'Deep nesting',
    shortDescription: 'Control flow nested past a configurable depth.',
    description:
      'Functions whose maximum block nesting exceeds the threshold are hard to ' +
      'read and reason about. Severity escalates as the depth grows further past ' +
      'the threshold.',
    category: 'complexity',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Flatten control flow with early returns, extracted helpers, or by ' +
      'replacing nested conditionals with lookup tables.',
    thresholds: [
      {
        name: 'depth',
        description: 'Maximum nesting depth beyond which a function is suspect.',
        defaultValue: 4,
      },
    ],
  },
  {
    ruleId: 'long-parameter-list',
    kind: 'long-parameter-list',
    name: 'Long parameter list',
    shortDescription: 'A function takes too many parameters.',
    description:
      'Functions with many parameters are hard to call correctly and signal that ' +
      'related data should be grouped into a value object. The detector counts ' +
      'declared parameters (including `self`/`cls` in Python) and flags any ' +
      'function past the threshold.',
    category: 'size',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Introduce a parameter object, pass a configuration dict/dataclass, or ' +
      'split the function so each part only needs a subset of the inputs.',
    thresholds: [
      {
        name: 'count',
        description: 'Parameter count beyond which a function is suspect.',
        defaultValue: 5,
      },
    ],
  },
  {
    ruleId: 'excessive-complexity',
    kind: 'excessive-complexity',
    name: 'Excessive cyclomatic complexity',
    shortDescription: 'A function has too many branching paths.',
    description:
      'Cyclomatic complexity counts independent paths through a function. Past a ' +
      'point, the function is hard to test exhaustively and hard to reason about. ' +
      'Distinct from `long-method`, which flags either length or complexity — this ' +
      'rule isolates the complexity signal so it is visible on its own.',
    category: 'complexity',
    defaultSeverity: 'major',
    languages: ['all'],
    remediation:
      'Extract sub-routines for each branch, replace nested conditionals with ' +
      'polymorphism or lookup tables, or simplify the control flow with guard ' +
      'clauses.',
    thresholds: [
      {
        name: 'complexity',
        description: 'Cyclomatic complexity beyond which a function is flagged.',
        defaultValue: 15,
      },
    ],
  },
  {
    ruleId: 'high-wmc',
    kind: 'high-wmc',
    name: 'High weighted methods per class',
    shortDescription: 'The sum of method complexities on a class is excessive.',
    description:
      'Weighted Methods per Class (WMC) sums the cyclomatic complexity of every ' +
      'method on a class. A high WMC means the class concentrates a lot of ' +
      'branching logic and is likely doing too much, even if individual methods ' +
      'look reasonable.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Split the class along its responsibilities. Move the most complex methods ' +
      'into dedicated collaborators.',
    thresholds: [
      {
        name: 'wmc',
        description: 'Sum of cyclomatic complexities beyond which the class is flagged.',
        defaultValue: 50,
      },
    ],
  },
  {
    ruleId: 'low-cohesion',
    kind: 'low-cohesion',
    name: 'Low module cohesion',
    shortDescription: "A module's files barely reference each other.",
    description:
      "Module cohesion measures what fraction of a module's imports stay within " +
      'the module versus reaching out to other modules. A low ratio suggests the ' +
      'module is a grab-bag: its files do not belong together.',
    category: 'cohesion',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Either split the module along the natural import clusters, or move files ' +
      'with weak ties into the modules they actually talk to.',
    thresholds: [
      {
        name: 'ratio',
        description: 'Cohesion ratio below which the module is flagged (0–1).',
        defaultValue: 0.3,
      },
    ],
  },
  {
    ruleId: 'hub-dependency',
    kind: 'hub-dependency',
    name: 'Hub-like dependency',
    shortDescription: 'Many modules depend on this module.',
    description:
      'A module that is imported by a large number of other modules is a hub: a ' +
      'change to its public interface ripples across the codebase. Hubs are not ' +
      'always wrong (logging, shared types), but unexpected hubs usually indicate ' +
      'a missing seam or an over-shared concept.',
    category: 'coupling',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Split the hub into smaller modules so dependents only pull in what they ' +
      'actually need, or invert the dependency so consumers receive what they ' +
      'need rather than reaching for the hub.',
    thresholds: [
      {
        name: 'fanIn',
        description: 'Number of inbound dependencies beyond which the module is flagged.',
        defaultValue: 8,
      },
    ],
  },
  {
    ruleId: 'empty-catch',
    kind: 'empty-catch',
    name: 'Empty catch block',
    shortDescription: 'An exception is caught and silently swallowed.',
    description:
      'Catching an exception only to discard it (e.g. `except: pass`) hides ' +
      'failures from operators and from future debuggers. The detector flags ' +
      'any except-clause whose body contains nothing but `pass` or `...`.',
    category: 'design',
    defaultSeverity: 'major',
    languages: ['python'],
    remediation:
      'Log the exception with context, re-raise it, or convert it to a domain ' +
      'error. If you really mean "ignore", add a comment that explains why.',
  },
  {
    ruleId: 'magic-numbers',
    kind: 'magic-numbers',
    name: 'Magic numbers',
    shortDescription: 'Unexplained numeric literals appear in the body.',
    description:
      'Bare numeric literals other than the common 0/1/-1 are easy to copy ' +
      'around and hard to change in one place. Flagging them encourages naming ' +
      'them as constants. The detector ignores literals in default values, ' +
      'simple indexing, and the common whitelist.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation: 'Lift the value into a module-level named constant.',
    thresholds: [
      {
        name: 'min',
        description: 'Minimum count of magic literals in one function to flag it.',
        defaultValue: 2,
      },
    ],
  },
  {
    ruleId: 'long-boolean-expression',
    kind: 'long-boolean-expression',
    name: 'Long boolean expression',
    shortDescription: 'A condition combines many AND/OR operators.',
    description:
      'Conditions that string together many logical operators are hard to read ' +
      'and easy to get wrong. The detector counts boolean operators in any ' +
      'condition and flags the function when one expression exceeds the limit.',
    category: 'complexity',
    defaultSeverity: 'minor',
    languages: ['python'],
    remediation:
      'Extract the predicate into a well-named function. If the predicate is ' +
      'really a disjunction over types, consider polymorphism.',
    thresholds: [
      {
        name: 'operators',
        description: 'AND/OR operator count in one condition before flagging.',
        defaultValue: 4,
      },
    ],
  },
  {
    ruleId: 'large-match',
    kind: 'large-match',
    name: 'Large match / if-elif chain',
    shortDescription: 'A switch-like construct grows past a safe number of cases.',
    description:
      'A long match-statement or if/elif chain often hides a missing polymorphic ' +
      'design. The detector counts case branches (Python `case`) plus elif ' +
      'clauses and flags the function when the total exceeds the threshold.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['python'],
    remediation:
      'Replace the chain with a lookup table, strategy object, or polymorphic ' + 'dispatch.',
    thresholds: [
      {
        name: 'cases',
        description: 'Number of cases/elif branches before flagging.',
        defaultValue: 8,
      },
    ],
  },
  {
    ruleId: 'commented-out-code',
    kind: 'commented-out-code',
    name: 'Commented-out code',
    shortDescription: 'Blocks of commented lines that look like real code.',
    description:
      'Commented-out code rots: it goes stale, but stays around scaring readers ' +
      'into thinking they might need it. The detector uses a small heuristic to ' +
      'detect Python-looking comments (assignment, def, import, etc.) and flags ' +
      'a file when more than a threshold of such lines accumulate.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation:
      'Delete it. Git remembers. If you need a snippet for reference, copy it ' +
      'into a real test or doc.',
    thresholds: [
      {
        name: 'lines',
        description: 'Number of suspicious comment lines in a file before flagging.',
        defaultValue: 3,
      },
    ],
  },
  {
    ruleId: 'todo-accumulation',
    kind: 'todo-accumulation',
    name: 'TODO / FIXME accumulation',
    shortDescription: 'A file collects too many unresolved TODO/FIXME/HACK markers.',
    description:
      'A few TODOs are healthy. A wall of them means the file is a backlog rather ' +
      'than working code. The detector counts TODO, FIXME, HACK, and XXX comments ' +
      'in a file and flags it past the configured count.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation:
      'Convert them into tracked issues, fix the smallest ones now, or remove ' +
      'TODOs that no longer make sense.',
    thresholds: [
      {
        name: 'count',
        description: 'TODO/FIXME/HACK count in one file before flagging.',
        defaultValue: 5,
      },
    ],
  },
  {
    ruleId: 'data-class',
    kind: 'data-class',
    name: 'Data class',
    shortDescription: 'A class is little more than a bag of attributes.',
    description:
      'A class with attributes but almost no behaviour is a sign that logic ' +
      'is happening elsewhere on its data — usually a candidate for Feature ' +
      'Envy. The detector flags classes that declare attributes but expose ' +
      'almost no methods.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation:
      'Move behaviour that operates on these attributes onto the class, or, if ' +
      'the data really is anaemic, use @dataclass / NamedTuple to make the ' +
      'intent explicit.',
    thresholds: [
      {
        name: 'maxMethods',
        description: 'A class with attributes and no more than this many methods is suspect.',
        defaultValue: 2,
      },
    ],
  },
  {
    ruleId: 'lazy-class',
    kind: 'lazy-class',
    name: 'Lazy class',
    shortDescription: 'A class is so small it might not justify existing.',
    description:
      'Lazy classes carry the cost of a class (an extra concept, an extra ' +
      'import) without delivering much. The detector flags very small classes ' +
      'with few methods.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation: 'Inline the class into its only caller, or merge it with a related class.',
    thresholds: [
      {
        name: 'maxLoc',
        description: 'A class smaller than this with ≤2 methods is suspect.',
        defaultValue: 15,
      },
    ],
  },
  {
    ruleId: 'primitive-obsession',
    kind: 'primitive-obsession',
    name: 'Primitive obsession',
    shortDescription: 'A long parameter list of untyped primitives.',
    description:
      'When a function takes many parameters that are all strings/ints/floats ' +
      'without annotations, callers can easily pass them in the wrong order. ' +
      'The detector flags functions over a parameter threshold that have no ' +
      'type annotations on their parameters.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['python'],
    remediation:
      'Group related primitives into a small dataclass or NamedTuple, or add ' +
      'type hints (NewType / Annotated) so misuse becomes a type error.',
    thresholds: [
      {
        name: 'params',
        description: 'Parameter count above which an unannotated signature is flagged.',
        defaultValue: 5,
      },
    ],
  },
  {
    ruleId: 'god-function',
    kind: 'god-function',
    name: 'God function',
    shortDescription: 'A module-level function does too much on its own.',
    description:
      'A top-level function (not a method) that is both long and complex acts ' +
      'like a procedural god class — it concentrates logic that should be ' +
      'distributed. The detector flags top-level functions exceeding both an ' +
      'LOC and complexity threshold.',
    category: 'size',
    defaultSeverity: 'major',
    languages: ['python'],
    remediation:
      'Extract cohesive blocks into helper functions; if state is shared ' +
      'across the blocks, consider a small class.',
    thresholds: [
      {
        name: 'loc',
        description: 'Lines of code beyond which a top-level function is flagged.',
        defaultValue: 80,
      },
      {
        name: 'complexity',
        description: 'Cyclomatic complexity beyond which a top-level function is flagged.',
        defaultValue: 15,
      },
    ],
  },
  {
    ruleId: 'cyclic-dependencies',
    kind: 'cyclic-dependencies',
    name: 'Cyclic dependencies',
    shortDescription: 'Two or more modules depend on each other.',
    description:
      'A dependency cycle between modules means none of them can be built, ' +
      'tested, or reasoned about in isolation. The detector surfaces each cycle ' +
      'returned by the module-graph SCC pass.',
    category: 'coupling',
    defaultSeverity: 'major',
    languages: ['all'],
    remediation:
      'Break the cycle by extracting the shared concept into a new module, by ' +
      'inverting one of the dependencies (Dependency Inversion Principle), or ' +
      'by moving the misplaced code to the module that really owns it.',
  },
  {
    ruleId: 'unstable-dependency',
    kind: 'unstable-dependency',
    name: 'Unstable dependency',
    shortDescription: 'A heavily-depended-on module is itself unstable.',
    description:
      "Robert Martin's instability metric (`fanOut / (fanIn + fanOut)`) measures " +
      'how much a module depends on others. When a module has both high ' +
      'instability and high fan-in, every change to it ripples broadly — exactly ' +
      'the worst combination.',
    category: 'coupling',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Stabilize the module by reducing its outgoing dependencies (extract a ' +
      'lower-level abstraction), or reduce its fan-in by giving callers ' +
      'narrower interfaces to depend on.',
    thresholds: [
      {
        name: 'instability',
        description: 'Instability (0–1) above which the module is flagged.',
        defaultValue: 0.8,
      },
    ],
  },
  {
    ruleId: 'god-package',
    kind: 'god-package',
    name: 'God package',
    shortDescription: 'A package contains too many files or too much code.',
    description:
      'A module that grows past safe limits in file count or LOC concentrates ' +
      'too much functionality in one folder, making changes harder to localize ' +
      'and ownership harder to assign.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Split the module along the natural concerns it already contains. Look ' +
      'for tight clusters in the dependency graph as split candidates.',
    thresholds: [
      {
        name: 'files',
        description: 'File count beyond which a module is flagged.',
        defaultValue: 20,
      },
      {
        name: 'loc',
        description: 'Total LOC beyond which a module is flagged.',
        defaultValue: 2000,
      },
    ],
  },
  {
    ruleId: 'scattered-functionality',
    kind: 'scattered-functionality',
    name: 'Scattered functionality',
    shortDescription: 'A module reaches into too many other modules.',
    description:
      'When one module imports from many siblings, the work it does is spread ' +
      'across the codebase — a small change here usually means small changes ' +
      'everywhere. The detector flags modules with a fan-out above the threshold.',
    category: 'coupling',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Move logic closer to the data it operates on. If the module is a thin ' +
      'orchestrator, that may be fine — suppress the rule for it.',
    thresholds: [
      {
        name: 'fanOut',
        description: 'Outgoing dependency count beyond which a module is flagged.',
        defaultValue: 8,
      },
    ],
  },
  {
    ruleId: 'cross-layer-skip',
    kind: 'cross-layer-skip',
    name: 'Cross-layer skip',
    shortDescription: 'A presentation-layer module reaches a data-layer module directly.',
    description:
      'Layered architectures (controller → service → repository) keep concerns ' +
      'separated. When a controller imports a repository directly, the service ' +
      'layer is bypassed and transactions / authorization / caching can no ' +
      'longer be added uniformly. The detector uses path/name heuristics to ' +
      'classify modules into layers.',
    category: 'design',
    defaultSeverity: 'major',
    languages: ['all'],
    remediation:
      'Route the call through a service-layer module. If no service exists for ' +
      'this flow yet, introduce one.',
  },
  {
    ruleId: 'missing-readme',
    kind: 'missing-readme',
    name: 'Missing README',
    shortDescription: 'The repository has no README in its root.',
    description:
      'A README is the first thing new contributors look for. Its absence is a ' +
      'small signal that the project assumes implicit context.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['all'],
    remediation:
      'Add a README.md at the repo root with at least: what the project is, ' +
      'how to install dependencies, and how to run it.',
  },
  {
    ruleId: 'missing-ci',
    kind: 'missing-ci',
    name: 'Missing CI configuration',
    shortDescription: 'No CI/CD config file detected in standard locations.',
    description:
      'A repo without CI relies on contributors running tests locally — which ' +
      "they often don't. The detector looks for the well-known CI config " +
      'locations (GitHub Actions, GitLab CI, CircleCI, Travis).',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['all'],
    remediation:
      'Add a minimal pipeline that at least runs the test suite on every push ' +
      'and pull request.',
  },
  {
    ruleId: 'missing-linter-config',
    kind: 'missing-linter-config',
    name: 'No linter or formatter configured',
    shortDescription: 'No linter/formatter config detected.',
    description:
      'Without a shared linter/formatter, style varies file-by-file and reviews ' +
      'spend time on cosmetics. The detector looks for ruff/flake8/black/' +
      'eslint/prettier configuration files.',
    category: 'design',
    defaultSeverity: 'info',
    languages: ['all'],
    remediation: 'Adopt a linter and formatter. Commit their config and run them in CI.',
  },
  {
    ruleId: 'missing-lockfile',
    kind: 'missing-lockfile',
    name: 'Missing dependency lockfile',
    shortDescription: 'A manifest file has no accompanying lockfile.',
    description:
      'Without a lockfile, two developers running install at different times ' +
      'can get different versions of the same dependencies — which breaks ' +
      '"works on my machine" debugging. The detector looks for package.json ' +
      'without pnpm-lock/package-lock/yarn.lock, and pyproject.toml without ' +
      'a Poetry/uv lock or pinned requirements.txt.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      "Commit your package manager's lockfile (`pnpm-lock.yaml`, `poetry.lock`, " +
      '`uv.lock`, etc.).',
  },
  {
    ruleId: 'build-artifacts-committed',
    kind: 'build-artifacts-committed',
    name: 'Build artifacts committed',
    shortDescription: 'Generated output directories appear inside the repo.',
    description:
      'Generated output (dist, build, __pycache__) should be ignored, not ' +
      'committed. Tracked artifacts cause noisy diffs and merge conflicts. The ' +
      'detector scans the file tree for the common offenders.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation: 'Delete the committed artifacts and add a matching pattern to .gitignore.',
  },
  {
    ruleId: 'large-binary-file',
    kind: 'large-binary-file',
    name: 'Large binary file in repo',
    shortDescription: 'A large non-text file is checked into the repo.',
    description:
      'Large binaries inflate clone size for everyone forever. They should ' +
      'live in artifact storage or Git LFS instead. The detector flags any ' +
      'file above a size threshold with an extension typical of binaries.',
    category: 'design',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation:
      'Move the asset to object storage / a CDN, or track it with Git LFS, and ' +
      'replace the committed copy with a pointer.',
    thresholds: [
      {
        name: 'bytes',
        description: 'File-size threshold in bytes.',
        defaultValue: 2 * 1024 * 1024,
      },
    ],
  },
  {
    ruleId: 'spring-layer-skip',
    kind: 'spring-layer-skip',
    name: 'Spring layer skip',
    shortDescription: 'Controller depends directly on a repository, skipping the service layer.',
    description:
      'In a layered Spring architecture, controllers should delegate to services, ' +
      'which own the business logic and call into repositories. A controller (or ' +
      'generic @Component) that injects a @Repository directly bypasses the ' +
      'service layer, making it hard to add transactional boundaries, caching, or ' +
      'authorization checks later.',
    category: 'design',
    defaultSeverity: 'major',
    languages: ['java'],
    remediation:
      'Introduce or extend a service class that wraps the repository call. ' +
      'Inject the service into the controller instead.',
  },
  {
    ruleId: 'spring-service-cycle',
    kind: 'spring-service-cycle',
    name: 'Spring service cycle',
    shortDescription: 'Two or more @Service beans inject each other forming a dependency cycle.',
    description:
      'Cyclic dependencies between services indicate that responsibilities are ' +
      'split poorly: each service half-owns work that should live together, or a ' +
      'shared collaborator needs to be extracted. Spring will start the cycle ' +
      "(thanks to setter / field injection), but it's a smell, not a feature.",
    category: 'coupling',
    defaultSeverity: 'major',
    languages: ['java'],
    remediation:
      'Extract the shared logic into a third service that both depend on, or ' +
      'merge the two services if their responsibilities truly are intertwined.',
  },
] as const;

/**
 * Lookup helper for detectors. Throws at module load time if a detector
 * references an unknown ruleId — keeps the catalog and the runtime honest.
 */
export function smellRule(ruleId: string): SmellDefinitionDto {
  const found = SMELL_CATALOG.find((d) => d.ruleId === ruleId);
  if (!found) {
    throw new Error(
      `Unknown smell ruleId "${ruleId}". Add it to SMELL_CATALOG in @archlens/shared-types.`
    );
  }
  return found;
}
