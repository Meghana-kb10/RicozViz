import type { LlmProvider } from './llm-provider.interface.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { MockLlmProvider } from './mock.provider.js';
import { logger } from '../../../../utils/logger.js';

let activeProviderOverride: LlmProvider | null = null;

export function setLlmProvider(provider: LlmProvider | null): void {
  activeProviderOverride = provider;
}

export function getLlmProvider(): LlmProvider {
  if (activeProviderOverride) {
    return activeProviderOverride;
  }

  const configuredProvider = (process.env['LLM_PROVIDER'] || 'anthropic').trim().toLowerCase();
  const apiKey = process.env['LLM_API_KEY'] || process.env['ANTHROPIC_API_KEY'];

  if (configuredProvider === 'anthropic') {
    if (apiKey) {
      return new AnthropicProvider();
    }

    logger.warn(
      'LLM_PROVIDER is set to "anthropic" but no LLM_API_KEY or ANTHROPIC_API_KEY was found in environment. Falling back to MockLlmProvider.'
    );
    return new MockLlmProvider();
  }

  if (configuredProvider === 'mock') {
    return new MockLlmProvider();
  }

  // Fallback default
  if (apiKey) {
    return new AnthropicProvider();
  }

  return new MockLlmProvider();
}
