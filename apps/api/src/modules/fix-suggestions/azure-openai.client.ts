import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureOpenAI } from 'openai';
import type { AppConfig } from '../../config/config.types';
import type { LlmClient, LlmRequest, LlmResponse } from './llm-client';

@Injectable()
export class AzureOpenAiClient implements LlmClient {
  private readonly logger = new Logger(AzureOpenAiClient.name);
  private readonly client?: AzureOpenAI;
  private readonly deployment: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const endpoint = this.config.get('AZURE_OPENAI_ENDPOINT', { infer: true });
    const apiKey = this.config.get('AZURE_OPENAI_API_KEY', { infer: true });
    const apiVersion = this.config.get('AZURE_OPENAI_API_VERSION', { infer: true });
    this.deployment = this.config.get('AZURE_OPENAI_DEPLOYMENT_NAME', { infer: true });

    if (endpoint && apiKey) {
      this.client = new AzureOpenAI({
        endpoint,
        apiKey,
        apiVersion,
        deployment: this.deployment,
      });
    } else {
      this.logger.warn(
        'Azure OpenAI not configured (AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY missing). Fix-suggestion endpoint will return 503.'
      );
    }
  }

  modelId(): string {
    return `azure-openai:${this.deployment}`;
  }

  isAvailable(): boolean {
    return this.client !== undefined;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'LLM not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.'
      );
    }
    const completion = await this.client.chat.completions.create({
      model: this.deployment,
      max_tokens: req.maxOutputTokens,
      temperature: 0.2,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
      throw new Error('LLM returned empty response');
    }
    return {
      content,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      model: this.modelId(),
    };
  }
}
