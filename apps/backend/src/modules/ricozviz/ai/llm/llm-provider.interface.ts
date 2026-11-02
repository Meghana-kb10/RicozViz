export interface LlmCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
}

export interface LlmProvider {
  readonly providerName: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
