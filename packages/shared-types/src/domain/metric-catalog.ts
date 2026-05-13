/**
 * Catalog of the four scoring metrics Archlens computes. Mirrors the role of
 * SMELL_CATALOG: a single source of truth used by both the API (exposed via
 * /metrics/catalog) and the web UI (`/metrics` page + per-repo "why this
 * score" panels). Editing an entry here is the only step needed to update
 * what users see — no frontend code changes required.
 *
 * The constants below MUST stay aligned with:
 *   - DEFAULT_WEIGHTS    in packages/analyzers/src/scoring/weights.default.ts
 *   - DEFAULT_THRESHOLDS in packages/analyzers/src/scoring/weights.default.ts
 *   - The derivation strings produced by computeScores() in
 *     packages/analyzers/src/scoring/engine.ts
 *
 * A unit test in @archlens/analyzers (test/scoring/metric-catalog-drift.spec.ts)
 * fails the build if the weight or threshold values drift apart.
 */

export type MetricId = 'cohesion' | 'coupling' | 'duplication' | 'complexity';

export interface FormulaStep {
  /** Short title for the step, e.g. "Per-module cohesion ratio". */
  label: string;
  /** Math expression in plain text — rendered as <code>. */
  expression: string;
  /** Plain-English explanation of what the step does and why. */
  explanation: string;
}

export interface MetricInputSpec {
  /** Display name of the input variable. */
  name: string;
  /** What this variable represents, in one sentence. */
  description: string;
  /** Where it's computed, as a `package/file` reference for source diving. */
  source: string;
}

export interface MetricScoreBand {
  /** Inclusive lower bound, 0–100. */
  min: number;
  /** Inclusive upper bound, 0–100. */
  max: number;
  /** Short label: Excellent / Good / At risk / Critical. */
  label: 'Excellent' | 'Good' | 'At risk' | 'Critical';
  /** One-sentence description of what scores in this band mean for the repo. */
  meaning: string;
}

export interface MetricImprovementStep {
  /** Short imperative headline ("Split god packages along import clusters"). */
  title: string;
  /** Longer body paragraph explaining the action. */
  detail: string;
  /**
   * Optional smell rule IDs that, when present in the repo, make this step
   * particularly relevant. The web UI uses these to reorder/highlight steps.
   */
  triggeringSmells?: ReadonlyArray<string>;
}

export interface MetricThresholdUsage {
  /** Key in DEFAULT_THRESHOLDS (e.g., 'longMethodComplexity'). */
  name: string;
  /** Default value mirrored from DEFAULT_THRESHOLDS at catalog-edit time. */
  value: number;
  /** What the threshold does in the formula or related detectors. */
  description: string;
}

export interface MetricDefinitionDto {
  metricId: MetricId;
  /** Human-readable label ("Cohesion"). */
  name: string;
  /** One-sentence summary for tab strips and cards. */
  shortDescription: string;
  /** A few sentences explaining what the metric measures and why it matters. */
  description: string;
  /**
   * Contribution to the overall score, mirrored from DEFAULT_WEIGHTS. The
   * remaining 0.20 belongs to 'smells', which has its own dedicated catalog.
   */
  weight: number;
  /** Ordered formula steps from raw signal to final 0–100 score. */
  formula: ReadonlyArray<FormulaStep>;
  /** The "100 − …" mapping that closes the loop, verbatim from engine.ts. */
  scoreDerivation: string;
  /** Where each input comes from in the codebase. */
  inputs: ReadonlyArray<MetricInputSpec>;
  /** Bands used to colour the score and explain its meaning. */
  bands: ReadonlyArray<MetricScoreBand>;
  /** The target band repos should aim for and why. */
  optimal: {
    min: number;
    rationale: string;
  };
  /** Ordered, actionable steps for improving the score. */
  improvementPlaybook: ReadonlyArray<MetricImprovementStep>;
  /** Smell rule IDs that, when present, drag this metric down. */
  relatedSmells: ReadonlyArray<string>;
  /** Thresholds from DEFAULT_THRESHOLDS that feed into the metric. */
  thresholdsUsed: ReadonlyArray<MetricThresholdUsage>;
}

export const METRIC_CATALOG: ReadonlyArray<MetricDefinitionDto> = [
  // ── Cohesion ────────────────────────────────────────────────────────────
  {
    metricId: 'cohesion',
    name: 'Cohesion',
    shortDescription: "How much of a module's imports stay inside the module.",
    description:
      'Cohesion measures whether the files that live inside a module actually ' +
      'belong together. A module with high cohesion has files that import ' +
      'mostly each other; a module with low cohesion is a grab-bag of ' +
      'unrelated files that happen to share a folder. Low cohesion makes ' +
      'change harder to localize: a single feature edit ends up touching ' +
      'every module instead of one.',
    weight: 0.15,
    formula: [
      {
        label: 'Per-module cohesion ratio',
        expression: 'cohesionRatio_M = internalEdges_M / (internalEdges_M + externalEdges_M)',
        explanation:
          'For each module M, count the file-to-file import edges that stay ' +
          'inside the module (internal) versus those that leave (external). ' +
          'A ratio of 1.0 means perfectly self-contained, 0.0 means every ' +
          'import points outward. Edges count once each — call frequency is ' +
          'ignored on purpose so a hot loop cannot inflate cohesion.',
      },
      {
        label: 'Workspace-grouped variant (when applicable)',
        expression:
          'groupRatio_M = internalGroupEdges_M / (internalGroupEdges_M + externalGroupEdges_M)',
        explanation:
          'When a workspace groups several submodules (e.g. a Spring ' +
          'controller + service + repository triplet), edges that cross ' +
          'submodule boundaries but stay inside the same workspace are ' +
          'reclassified as internal. The score-driving ratio is the grouped ' +
          'one when available, otherwise the plain inner ratio.',
      },
      {
        label: 'LOC-weighted aggregation',
        expression: 'cohesionWeighted = Σ groupRatio_M × loc_M  (over modules with signal)',
        explanation:
          'Sum the per-module ratios weighted by lines of code so a tiny ' +
          'toy module cannot dominate the repo score. Modules with only one ' +
          'file (no internal edges possible) and modules that import nothing ' +
          'are excluded entirely.',
      },
      {
        label: 'Final score',
        expression: 'cohesionScore = (cohesionWeighted / Σ loc_M) × 100',
        explanation:
          'Divide by total LOC across the contributing modules to get the ' +
          'weighted average, then scale to 0–100.',
      },
    ],
    scoreDerivation: 'LOC-weighted average of per-module cohesion ratios × 100',
    inputs: [
      {
        name: 'fileEdges',
        description: 'File-to-file import edges across the repo.',
        source: 'packages/analyzers/src/graph/graph-builder.ts',
      },
      {
        name: 'fileToModule',
        description: 'Maps each file to the module it lives in.',
        source: 'packages/analyzers/src/diagrams/module-graph.builder.ts',
      },
      {
        name: 'moduleSizes',
        description: 'Per-module LOC totals and file counts used for weighting.',
        source: 'packages/analyzers/src/metrics/cohesion.ts',
      },
      {
        name: 'fileToGroup (optional)',
        description: 'Workspace grouping for projects that span multiple submodules.',
        source: 'packages/analyzers/src/adapters/*/workspace-detector.ts',
      },
    ],
    bands: [
      {
        min: 80,
        max: 100,
        label: 'Excellent',
        meaning: 'Modules are well-bounded. Features map cleanly onto folders.',
      },
      {
        min: 60,
        max: 79,
        label: 'Good',
        meaning: 'Most modules hold together, a few have leaky boundaries worth tightening.',
      },
      {
        min: 40,
        max: 59,
        label: 'At risk',
        meaning: 'Several modules are grab-bags. Change is starting to spread across folders.',
      },
      {
        min: 0,
        max: 39,
        label: 'Critical',
        meaning:
          'Module boundaries do not reflect the code. Refactoring will be expensive but valuable.',
      },
    ],
    optimal: {
      min: 75,
      rationale:
        'At 75+ the typical change touches one or two modules. Below that ' +
        'cross-module edits become routine and review cost climbs.',
    },
    improvementPlaybook: [
      {
        title: 'Split modules along their natural import clusters',
        detail:
          'Run the architecture view, find modules whose files cluster into ' +
          'two or three distinct sub-graphs, and move each cluster into its ' +
          'own module. The new modules will instantly score higher because ' +
          'the cluster-internal edges become module-internal.',
        triggeringSmells: ['low-cohesion', 'god-package'],
      },
      {
        title: 'Relocate weak-tie files to where they actually talk',
        detail:
          'Sort the per-module table by cohesionRatio ascending. For each ' +
          'low-cohesion module, look at the files inside it: any file that ' +
          'imports more from a sibling module than from its own home should ' +
          'move to that sibling.',
        triggeringSmells: ['scattered-functionality', 'low-cohesion'],
      },
      {
        title: 'Promote shared concepts to a dedicated module',
        detail:
          'If many modules import the same utility file, that file is ' +
          'creating external edges from all of them. Lifting it (and its ' +
          'kin) into a `shared/` or `core/` module concentrates the leaks ' +
          'into one well-named place.',
      },
    ],
    relatedSmells: ['low-cohesion', 'god-package', 'scattered-functionality'],
    thresholdsUsed: [
      {
        name: 'lowCohesionRatio',
        value: 0.3,
        description:
          'Modules whose internal-edge ratio falls below this value are flagged with the low-cohesion smell.',
      },
    ],
  },

  // ── Coupling ────────────────────────────────────────────────────────────
  {
    metricId: 'coupling',
    name: 'Coupling',
    shortDescription: 'How tangled the dependencies between modules are.',
    description:
      'Coupling captures how much modules depend on one another. Some ' +
      'coupling is unavoidable — a service depends on a repository, a ' +
      'controller depends on a service. The metric penalises the unhealthy ' +
      'shapes: hubs that everyone imports, dual-hubs that consume and ' +
      'provide in equal volume, dependency cycles, and modules sitting in ' +
      "Robert Martin's zone of pain (concrete but heavily depended on).",
    weight: 0.25,
    formula: [
      {
        label: 'Fan-in and fan-out per module',
        expression: 'fanIn_M = #{distinct importers of M}    fanOut_M = #{distinct imports of M}',
        explanation:
          'Build the module-level dependency graph and count incoming and ' +
          'outgoing edges per module. Self-edges are dropped.',
      },
      {
        label: 'Instability and abstractness',
        expression: 'I_M = fanOut_M / (fanIn_M + fanOut_M)    A_M = abstractTypes_M / totalTypes_M',
        explanation:
          'Instability ranges from 0 (stable provider, only imported) to 1 ' +
          '(volatile consumer, only imports). Abstractness is the fraction ' +
          'of declared types that are interfaces or abstract classes.',
      },
      {
        label: 'Distance from the main sequence',
        expression: 'D_M = |A_M + I_M − 1|',
        explanation:
          "Martin's main sequence runs from (0, 1) — abstract & stable — to " +
          '(1, 0) — concrete & volatile. Distance D_M measures how far a ' +
          'module strays from that line. Big values flag the zone of pain ' +
          '(concrete + stable: hard to change, lots of callers) or the zone ' +
          'of uselessness (abstract + volatile: nobody depends on it).',
      },
      {
        label: 'Penalties',
        expression: 'avgPenalty + hubPenalty + dualHubPenalty + painPenalty + cyclePenalty',
        explanation:
          'avgPenalty = max(0, avgFanOut − 1) × 10. hubPenalty kicks in ' +
          'past max(5, ⌈moduleCount × 0.3⌉) at 4 points per excess module ' +
          'depended-on. dualHubPenalty fires past max(25, moduleCount × 4) ' +
          'at 1.5 points per excess fanIn × fanOut. painPenalty = ' +
          'Σ max(0, D_M − 0.5) × 6 across modules with abstractness data. ' +
          'cyclePenalty = cycleCount × 15.',
      },
      {
        label: 'Final score',
        expression: 'couplingScore = 100 − Σ penalties (clamped to [0, 100])',
        explanation: 'Subtract every penalty from 100 and clamp.',
      },
    ],
    scoreDerivation: '100 − avg-fanOut penalty − hub penalty − dual-hub penalty − cycle penalty',
    inputs: [
      {
        name: 'edges',
        description: 'Module-level dependency edges built from file imports.',
        source: 'packages/analyzers/src/graph/graph-builder.ts',
      },
      {
        name: 'cycles',
        description: 'Strongly-connected components in the module graph.',
        source: 'packages/analyzers/src/graph/cycle-detector.ts',
      },
      {
        name: 'typeCounts',
        description: 'Total vs. abstract type counts per module (for abstractness).',
        source: 'packages/analyzers/src/adapters/java/javaparser.runner.ts',
      },
    ],
    bands: [
      {
        min: 80,
        max: 100,
        label: 'Excellent',
        meaning: 'No cycles, no hubs, stable abstractions where they matter.',
      },
      {
        min: 60,
        max: 79,
        label: 'Good',
        meaning: 'A hub or two, no cycles. Manageable but worth watching.',
      },
      {
        min: 40,
        max: 59,
        label: 'At risk',
        meaning:
          'Cycles or a god-module is starting to dominate the graph. Every change is ' +
          'rippling further than it should.',
      },
      {
        min: 0,
        max: 39,
        label: 'Critical',
        meaning:
          'Multiple cycles or extreme hubs. The dependency graph is the bottleneck of every change.',
      },
    ],
    optimal: {
      min: 80,
      rationale:
        'Coupling has the largest weight in the overall score (0.25), so ' +
        'every cycle broken or hub split is worth ~15 points. 80+ usually ' +
        'means zero cycles and at most one acceptable hub (logger / shared types).',
    },
    improvementPlaybook: [
      {
        title: 'Break dependency cycles',
        detail:
          'Each cycle costs 15 points outright. Use the Architecture page to ' +
          'find the cycle, then either invert one of the dependencies (depend ' +
          'on an interface owned by the other side), extract the shared ' +
          'concept into a third module, or merge the cycle members if they ' +
          'really share a single responsibility.',
        triggeringSmells: ['cyclic-dependencies', 'spring-service-cycle'],
      },
      {
        title: 'Split hub modules',
        detail:
          'A hub is a module imported by many siblings. Find it on the ' +
          'modules table (high fanIn). Carve out the smallest piece each ' +
          'caller actually needs and turn it into its own module. Consumers ' +
          'then only depend on the slice they use.',
        triggeringSmells: ['hub-dependency'],
      },
      {
        title: 'Stabilize unstable, heavily-used modules',
        detail:
          'A module with high instability and high fan-in is a dual-hub: ' +
          'lots of code reaches into it, and it reaches into lots of code. ' +
          'Extract its outgoing dependencies into a lower layer so the ' +
          'module stops both consuming and providing in volume.',
        triggeringSmells: ['unstable-dependency'],
      },
      {
        title: 'Reduce fan-out on orchestrators',
        detail:
          'A module that imports from many siblings is doing scattered ' +
          'work. Move the logic to where the data lives, or, if the module ' +
          'really is a thin orchestrator, accept the smell after suppressing it.',
        triggeringSmells: ['scattered-functionality'],
      },
    ],
    relatedSmells: [
      'cyclic-dependencies',
      'hub-dependency',
      'unstable-dependency',
      'scattered-functionality',
      'spring-service-cycle',
      'spring-layer-skip',
      'cross-layer-skip',
    ],
    thresholdsUsed: [
      {
        name: 'hubFanIn',
        value: 8,
        description: 'Inbound dependency count above which a module is flagged as a hub.',
      },
      {
        name: 'scatteredFanOut',
        value: 8,
        description:
          'Outbound dependency count above which a module is flagged for scattered functionality.',
      },
      {
        name: 'unstableInstability',
        value: 0.8,
        description: 'Instability ratio above which a heavily-imported module is flagged.',
      },
    ],
  },

  // ── Duplication ─────────────────────────────────────────────────────────
  {
    metricId: 'duplication',
    name: 'Duplication',
    shortDescription: 'How much of the codebase is verbatim copy-paste.',
    description:
      'Duplication tracks the fraction of source lines that appear in two ' +
      'or more places. Duplicated code multiplies the cost of every change: ' +
      'a bug fix has to be applied everywhere, often inconsistently. ' +
      'Archlens uses jscpd under the hood, which compares token streams ' +
      'and so catches near-duplicates that differ only in whitespace or ' +
      'identifier names.',
    weight: 0.15,
    formula: [
      {
        label: 'Clone detection',
        expression: 'clones = jscpd.detectClones(repoPath, { minTokens: 50 })',
        explanation:
          'Run jscpd across TypeScript, JavaScript, Python, and Java files. ' +
          'Any run of ≥ 50 tokens that appears twice is reported as a clone ' +
          'pair, regardless of whitespace or identifier names.',
      },
      {
        label: 'Per-file duplicate-line merging',
        expression: 'duplicateLines = Σ_file mergeOverlapping(cloneRanges_file)',
        explanation:
          'Merge overlapping line ranges within each file before summing. ' +
          'This prevents a single line being counted twice when it lives ' +
          'inside two overlapping clones.',
      },
      {
        label: 'Duplication ratio',
        expression: 'ratio = min(1, duplicateLines / totalLoc)',
        explanation:
          "Divide by total source LOC from the IR (not jscpd's own token " +
          'percentage, since LOC is a more intuitive denominator). Clamp to ' +
          '1.0 in case a pathological file pushes the count over the total.',
      },
      {
        label: 'Final score',
        expression: 'duplicationScore = 100 − ratio × 100  (clamped to [0, 100])',
        explanation: 'One duplicated line costs one point. 5% duplication → 95, 30% → 70.',
      },
    ],
    scoreDerivation: '100 − duplicate-lines ratio × 100',
    inputs: [
      {
        name: 'repo source files',
        description: 'Every file in supported languages, fed directly to jscpd.',
        source: 'packages/analyzers/src/metrics/duplication.ts',
      },
      {
        name: 'totalLoc',
        description: 'Total LOC reported by the language adapters, used as denominator.',
        source: 'packages/analyzers/src/metrics/size.ts',
      },
    ],
    bands: [
      {
        min: 90,
        max: 100,
        label: 'Excellent',
        meaning: 'Under 10% duplication — well within healthy range for any real codebase.',
      },
      {
        min: 75,
        max: 89,
        label: 'Good',
        meaning: 'Some duplication, mostly in tests or boilerplate. Worth a sweep when convenient.',
      },
      {
        min: 50,
        max: 74,
        label: 'At risk',
        meaning:
          'A quarter to a half of the code is repeated. Bug fixes are leaking past one site.',
      },
      {
        min: 0,
        max: 49,
        label: 'Critical',
        meaning: 'More than half the code is duplicated. Almost certainly a copy-paste explosion.',
      },
    ],
    optimal: {
      min: 90,
      rationale:
        'Below 10% duplication is realistic for any maintained codebase. ' +
        'Going much further (5% or less) tends to over-abstract and hurts ' +
        'cohesion, so 90+ is the sweet spot.',
    },
    improvementPlaybook: [
      {
        title: 'Extract the largest clone groups first',
        detail:
          'Sort the clones list by line count. The top one or two clones ' +
          'usually account for the majority of duplicate lines — extract ' +
          'them into a shared function or module before touching the long tail.',
      },
      {
        title: 'Convert near-duplicates into parameterised helpers',
        detail:
          'jscpd token-matching catches snippets that differ only in names ' +
          'or constants. Those are exactly the cases where a single helper ' +
          'with a parameter or two replaces both copies.',
      },
      {
        title: 'Generate, do not copy, boilerplate',
        detail:
          'When duplication clusters in DTOs, validation schemas, or ' +
          'serialisers, a generator (zod schema + inferred type, codegen ' +
          'from OpenAPI, etc.) replaces an indefinite number of copies with one source.',
      },
      {
        title: 'Suppress unavoidable duplication explicitly',
        detail:
          'Some duplication is genuinely the right call (snapshot fixtures, ' +
          'language-required boilerplate). Use the jscpd-ignore or an ' +
          '@archlens-ignore comment so the score reflects the duplication you can fix.',
      },
    ],
    relatedSmells: [],
    thresholdsUsed: [
      {
        name: 'jscpd.minTokens',
        value: 50,
        description: 'Minimum run of identical tokens that counts as a clone.',
      },
    ],
  },

  // ── Complexity ──────────────────────────────────────────────────────────
  {
    metricId: 'complexity',
    name: 'Complexity',
    shortDescription: 'How concentrated cyclomatic complexity is across the code.',
    description:
      'Complexity scores how much branching is concentrated in a small ' +
      'number of hot-spot functions. The signal is hot-spot density — not ' +
      'average complexity — because a few very gnarly functions are far ' +
      'worse than uniformly mild complexity spread across the codebase. ' +
      'Cyclomatic complexity is computed per function over the tree-sitter ' +
      'AST with a language-specific list of decision nodes.',
    weight: 0.25,
    formula: [
      {
        label: 'Per-function cyclomatic complexity',
        expression: 'cyclomatic = 1 + #{decision nodes} + #{boolean operators}',
        explanation:
          'Walk each function body. Add one for every decision node ' +
          '(if / for / while / except / case / ternary / …) and one for ' +
          'every logical operator (&&, ||, ??, Python `and`/`or`). The base ' +
          'of 1 means a straight-line function scores 1.',
      },
      {
        label: 'Hot-spot identification',
        expression: 'function is hot-spot iff cyclomatic > longMethodComplexity',
        explanation:
          'A function whose complexity exceeds the long-method complexity ' +
          'threshold (default 10) counts as a hot-spot. Hot-spots are the ' +
          'only functions that affect the score.',
      },
      {
        label: 'Hot-spot excess',
        expression: 'hotSpotExcess = Σ (cyclomatic − threshold)  over hot-spots',
        explanation:
          'For each hot-spot, accumulate how far past the threshold it ' +
          'lives. A function at 11 contributes 1; a function at 30 ' +
          'contributes 20. This is the "how bad" measure — count alone hides ' +
          'severity.',
      },
      {
        label: 'Hot-spot density',
        expression: 'hotSpotPerKloc = hotSpotExcess × 1000 / totalLoc',
        explanation:
          'Normalise the excess by kilo-LOC so a big repo with a few hot ' +
          'functions does not look as bad as a small repo with the same count.',
      },
      {
        label: 'Final score',
        expression: 'complexityScore = 100 − hotSpotPerKloc × 2  (clamped to [0, 100])',
        explanation:
          'One excess complexity point per KLOC costs two score points. ' +
          'A medium repo with ten hot functions at +5 over threshold loses ' +
          'roughly 10–20 points.',
      },
    ],
    scoreDerivation: '100 − hot-spot density × 2',
    inputs: [
      {
        name: 'function bodies',
        description: 'tree-sitter syntax nodes for every detected function.',
        source: 'packages/analyzers/src/adapters/*/parser.ts',
      },
      {
        name: 'PYTHON_COMPLEXITY / NODE_COMPLEXITY',
        description:
          'Language-specific config: which AST node types count as decision/nesting/boolean nodes.',
        source: 'packages/analyzers/src/metrics/complexity.ts',
      },
      {
        name: 'totalLoc',
        description: 'Repo-wide LOC, used as the KLOC denominator.',
        source: 'packages/analyzers/src/metrics/size.ts',
      },
    ],
    bands: [
      {
        min: 85,
        max: 100,
        label: 'Excellent',
        meaning:
          'Very few hot-spot functions for the repo size. Branching is spread evenly across the code.',
      },
      {
        min: 65,
        max: 84,
        label: 'Good',
        meaning: 'A handful of hot-spots, none egregious. Fix them when next touched.',
      },
      {
        min: 40,
        max: 64,
        label: 'At risk',
        meaning:
          'Several functions sit well past the threshold. They will be the bug magnets and the merge-conflict centres.',
      },
      {
        min: 0,
        max: 39,
        label: 'Critical',
        meaning:
          'Hot-spot density is so high it dominates the score. The repo likely has multi-hundred-line, deeply-branched functions.',
      },
    ],
    optimal: {
      min: 85,
      rationale:
        'Complexity is one of the two heaviest weights (0.25). A small ' +
        'number of focused extractions usually pushes a repo from the 60s ' +
        'into the 85+ band quickly, with outsized impact on the overall grade.',
    },
    improvementPlaybook: [
      {
        title: 'Extract sub-routines from the worst offenders',
        detail:
          'Open the Hotspots page, sort by cyclomatic complexity, and pick ' +
          'the top 3. Each one is responsible for a disproportionate ' +
          'fraction of hotSpotExcess. Pull cohesive blocks into named ' +
          'helpers — the complexity drops to the maximum branch path.',
        triggeringSmells: ['long-method', 'excessive-complexity', 'god-function'],
      },
      {
        title: 'Flatten nested control flow',
        detail:
          'Replace pyramids of `if (x) { if (y) { … } }` with guard clauses ' +
          'that return early. Each early return collapses one nesting level ' +
          'and reduces cognitive complexity without changing behaviour.',
        triggeringSmells: ['deep-nesting'],
      },
      {
        title: 'Replace long if/elif chains with dispatch tables',
        detail:
          'A function that branches on a string or enum eight different ' +
          'ways is one polymorphic dispatch or one lookup table away from ' +
          'a single-branch function. Each removed case removes a cyclomatic point.',
        triggeringSmells: ['large-match'],
      },
      {
        title: 'Decompose god functions into a small class',
        detail:
          'When extraction fails because helpers all need the same five ' +
          'variables, the function has grown a hidden object. Turn the ' +
          'shared state into fields of a small class and the methods become naturally short.',
        triggeringSmells: ['god-function', 'high-wmc'],
      },
    ],
    relatedSmells: [
      'long-method',
      'excessive-complexity',
      'deep-nesting',
      'long-boolean-expression',
      'large-match',
      'high-wmc',
      'god-function',
    ],
    thresholdsUsed: [
      {
        name: 'longMethodComplexity',
        value: 10,
        description:
          'Cyclomatic complexity above which a function counts as a hot-spot in the scoring formula.',
      },
      {
        name: 'longMethodLoc',
        value: 30,
        description: 'Lines of code beyond which a method is also flagged as long.',
      },
      {
        name: 'deepNestingDepth',
        value: 4,
        description: 'Nesting depth at which deep-nesting fires.',
      },
      {
        name: 'excessiveComplexity',
        value: 15,
        description: 'Complexity at which the dedicated excessive-complexity rule fires.',
      },
    ],
  },
] as const;

/**
 * Lookup helper. Throws at module-load time if a caller references a metricId
 * that does not exist in the catalog. Use this rather than indexing the array
 * directly so typos surface immediately.
 */
export function metricDefinition(metricId: MetricId): MetricDefinitionDto {
  const found = METRIC_CATALOG.find((m) => m.metricId === metricId);
  if (!found) {
    throw new Error(
      `Unknown metricId "${metricId}". Add it to METRIC_CATALOG in @archlens/shared-types.`
    );
  }
  return found;
}
