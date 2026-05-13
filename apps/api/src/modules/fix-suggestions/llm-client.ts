export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}

export interface LlmResponse {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  model: string;
}

export interface LlmClient {
  /** Stable identifier of the underlying model — used as a cache key. */
  modelId(): string;
  /** True if the client is configured and ready to call the upstream service. */
  isAvailable(): boolean;
  generate(req: LlmRequest): Promise<LlmResponse>;
}
