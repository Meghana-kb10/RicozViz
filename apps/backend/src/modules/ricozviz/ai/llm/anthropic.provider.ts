import Anthropic from '@anthropic-ai/sdk';
import type { LlmCompletionRequest, LlmCompletionResponse, LlmProvider } from './llm-provider.interface.js';
import { AppError } from '../../../../utils/errors.js';
import { logger } from '../../../../utils/logger.js';

export class AnthropicProvider implements LlmProvider {
  readonly providerName = 'anthropic';
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env['LLM_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw AppError.badRequest(
        'Anthropic provider configured but LLM_API_KEY / ANTHROPIC_API_KEY environment variable is missing.'
      );
    }

    this.defaultModel = model || process.env['LLM_MODEL'] || 'claude-3-5-sonnet-20241022';
    this.client = new Anthropic({
      apiKey: key,
      timeout: 30000,
      maxRetries: 1
    });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const model = this.defaultModel;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 1500,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.userPrompt
          }
        ]
      });

      // Extract text content
      const contentParts = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text);

      const content = contentParts.join('\n').trim();

      const promptTokens = response.usage?.input_tokens ?? 0;
      const completionTokens = response.usage?.output_tokens ?? 0;
      const totalTokens = promptTokens + completionTokens;

      return {
        content,
        promptTokens,
        completionTokens,
        totalTokens,
        model,
        provider: this.providerName
      };
    } catch (error) {
      logger.error('Anthropic API completion failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AppError) throw error;

      if (error instanceof Anthropic.APIError) {
        throw AppError.badRequest(`Anthropic LLM error (${error.status}): ${error.message}`);
      }

      throw AppError.badRequest(
        `Failed to generate completion from Anthropic LLM: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
