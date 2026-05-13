import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FixSuggestionDto } from '@archlens/shared-types';
import type { AppConfig } from '../../config/config.types';
import { PrismaService } from '../../database/prisma.service';
import { SourceLoader } from '../reports/source-loader';
import { AzureOpenAiClient } from './azure-openai.client';
import { PromptBuilder, type SmellContext } from './prompt-builder';

@Injectable()
export class FixSuggestionsService {
  private readonly logger = new Logger(FixSuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly llm: AzureOpenAiClient,
    private readonly promptBuilder: PromptBuilder,
    private readonly sourceLoader: SourceLoader
  ) {}

  async suggest(
    userId: string,
    scanId: string,
    smellId: string,
    options: { force?: boolean } = {}
  ): Promise<FixSuggestionDto> {
    if (!this.llm.isAvailable()) {
      throw new ServiceUnavailableException(
        'LLM not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.'
      );
    }

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { repository: { select: { userId: true } }, report: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.repository.userId !== userId) throw new ForbiddenException();
    if (!scan.report) throw new NotFoundException('Report not ready');
    const report = scan.report;

    // `smellId` is the IR slug (e.g. "smell_long_method_1") — that's what the
    // Smell DTO exposes as `id`. The DB primary key is a separate UUID we
    // never surface to clients.
    const smell = await this.prisma.smell.findFirst({
      where: { irSmellId: smellId, reportId: report.id },
      include: { file: true },
    });
    if (!smell) throw new NotFoundException('Smell not found in this scan');
    if (!smell.file) throw new NotFoundException('Smell has no associated file');

    const source = await this.sourceLoader.loadFile(report.sourceDirPath, smell.file.irFileId);
    if (source === null) {
      throw new NotFoundException(
        'Source not available for this smell. The report may predate source snapshotting.'
      );
    }

    const ctx: SmellContext = {
      ruleId: smell.ruleId,
      severity: smell.severity,
      message: smell.message,
      filePath: smell.filePath,
      language: smell.file.language,
      startLine: smell.startLine,
      endLine: smell.endLine,
    };

    const { systemPrompt, userPrompt } = this.promptBuilder.build(ctx, source);
    const promptHash = hashPrompt(systemPrompt, userPrompt);
    const model = this.llm.modelId();

    if (!options.force) {
      const cached = await this.prisma.fixSuggestion.findUnique({
        where: {
          smellId_model_promptHash: {
            smellId: smell.id,
            model,
            promptHash,
          },
        },
      });
      if (cached) return toDto(cached, true);
    }

    let llmResponse;
    try {
      llmResponse = await this.llm.generate({
        systemPrompt,
        userPrompt,
        maxOutputTokens: this.config.get('LLM_MAX_OUTPUT_TOKENS', { infer: true }),
      });
    } catch (err) {
      this.logger.error(`LLM call failed: ${(err as Error).message}`);
      throw new BadGatewayException(`LLM request failed: ${(err as Error).message}`);
    }

    const saved = await this.prisma.fixSuggestion.upsert({
      where: {
        smellId_model_promptHash: { smellId: smell.id, model, promptHash },
      },
      update: {
        contentMarkdown: llmResponse.content,
        promptTokens: llmResponse.promptTokens ?? null,
        completionTokens: llmResponse.completionTokens ?? null,
      },
      create: {
        smellId: smell.id,
        reportId: report.id,
        model,
        promptHash,
        contentMarkdown: llmResponse.content,
        promptTokens: llmResponse.promptTokens ?? null,
        completionTokens: llmResponse.completionTokens ?? null,
      },
    });

    return toDto(saved, false);
  }
}

function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash('sha256').update(systemPrompt).update('').update(userPrompt).digest('hex');
}

interface FixSuggestionRow {
  id: string;
  smellId: string;
  model: string;
  promptHash: string;
  contentMarkdown: string;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
}

function toDto(row: FixSuggestionRow, cached: boolean): FixSuggestionDto {
  return {
    id: row.id,
    smellId: row.smellId,
    model: row.model,
    promptHash: row.promptHash,
    contentMarkdown: row.contentMarkdown,
    promptTokens: row.promptTokens ?? undefined,
    completionTokens: row.completionTokens ?? undefined,
    generatedAt: row.createdAt.toISOString(),
    cached,
  };
}
