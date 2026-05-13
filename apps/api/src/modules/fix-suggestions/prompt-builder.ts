import { Injectable } from '@nestjs/common';
import { SMELL_CATALOG, type SmellDefinitionDto } from '@archlens/shared-types';

export interface SmellContext {
  ruleId: string;
  severity: string;
  message: string;
  filePath: string;
  language: string;
  startLine: number | null;
  endLine: number | null;
}

export interface PromptOutput {
  systemPrompt: string;
  userPrompt: string;
}

const SYSTEM_PROMPT = [
  'You are a senior software engineer reviewing a code smell flagged by a static analyzer.',
  'Be concise, specific, and pragmatic. Use the snippet line numbers when citing locations.',
  'Output Markdown with these sections in order:',
  '1. **Why it matters here** — one or two sentences specific to this snippet (avoid generic textbook language).',
  '2. **Suggested change** — the smallest safe edit. Include a short ```language code block with the proposed replacement when useful.',
  '3. **Caveats / when to ignore** — one short bullet list, or "None." if the smell is unambiguous.',
  '',
  'If the snippet looks like the smell is a false positive, say so explicitly in section 1 and skip section 2.',
].join('\n');

const SNIPPET_CONTEXT_LINES = 20;
const MAX_SNIPPET_LINES = 400;

@Injectable()
export class PromptBuilder {
  build(ctx: SmellContext, source: string): PromptOutput {
    const rule = findRule(ctx.ruleId);
    const snippet = sliceWindow(source, ctx.startLine, ctx.endLine);

    const rulePart = rule
      ? [
          `Rule: ${rule.name} (${rule.ruleId})`,
          `Category: ${rule.category}, default severity: ${rule.defaultSeverity}`,
          `What the rule means: ${rule.description}`,
          `General remediation guidance: ${rule.remediation}`,
        ].join('\n')
      : `Rule: ${ctx.ruleId} (no catalog entry — use only the smell message and snippet as guidance)`;

    const userPrompt = [
      rulePart,
      '',
      `File: ${ctx.filePath}`,
      `Language: ${ctx.language}`,
      `Severity: ${ctx.severity}`,
      `Analyzer message: ${ctx.message}`,
      ctx.startLine !== null && ctx.endLine !== null
        ? `Smell spans lines ${ctx.startLine}-${ctx.endLine} of the file.`
        : 'No precise line range was provided.',
      '',
      'Snippet (line numbers shown on the left, the offending lines are marked with `>`):',
      '```' + ctx.language,
      snippet.text,
      '```',
      snippet.truncated
        ? '\n(Snippet truncated because the source window exceeded the limit.)'
        : '',
      '',
      'Write the markdown response now.',
    ]
      .filter(Boolean)
      .join('\n');

    return { systemPrompt: SYSTEM_PROMPT, userPrompt };
  }
}

function findRule(ruleId: string): SmellDefinitionDto | undefined {
  return SMELL_CATALOG.find((r) => r.ruleId === ruleId);
}

interface Snippet {
  text: string;
  truncated: boolean;
}

function sliceWindow(source: string, startLine: number | null, endLine: number | null): Snippet {
  const lines = source.split(/\r?\n/);
  const start = startLine ?? 1;
  const end = endLine ?? start;
  const from = Math.max(1, start - SNIPPET_CONTEXT_LINES);
  let to = Math.min(lines.length, end + SNIPPET_CONTEXT_LINES);

  let truncated = false;
  if (to - from + 1 > MAX_SNIPPET_LINES) {
    to = from + MAX_SNIPPET_LINES - 1;
    truncated = true;
  }

  const gutterWidth = String(to).length;
  const out: string[] = [];
  for (let i = from; i <= to; i += 1) {
    const lineText = lines[i - 1] ?? '';
    const marker = i >= start && i <= end ? '>' : ' ';
    out.push(`${marker} ${String(i).padStart(gutterWidth, ' ')} | ${lineText}`);
  }
  return { text: out.join('\n'), truncated };
}
