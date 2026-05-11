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
