import type { LlmCompletionRequest, LlmCompletionResponse, LlmProvider } from './llm-provider.interface.js';

export interface MockLlmResponseOverride {
  content?: string;
  error?: Error;
}

export class MockLlmProvider implements LlmProvider {
  readonly providerName = 'mock';
  private customHandler?: (request: LlmCompletionRequest) => Promise<LlmCompletionResponse> | LlmCompletionResponse;
  private queuedResponses: MockLlmResponseOverride[] = [];

  constructor(customHandler?: (request: LlmCompletionRequest) => Promise<LlmCompletionResponse> | LlmCompletionResponse) {
    this.customHandler = customHandler;
  }

  queueResponse(override: MockLlmResponseOverride): void {
    this.queuedResponses.push(override);
  }

  setHandler(handler: (request: LlmCompletionRequest) => Promise<LlmCompletionResponse> | LlmCompletionResponse): void {
    this.customHandler = handler;
  }

  clearQueue(): void {
    this.queuedResponses = [];
    this.customHandler = undefined;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (this.queuedResponses.length > 0) {
      const next = this.queuedResponses.shift()!;
      if (next.error) throw next.error;
      if (next.content) {
        return {
          content: next.content,
          promptTokens: 120,
          completionTokens: 65,
          totalTokens: 185,
          model: 'mock-llm-v1',
          provider: this.providerName
        };
      }
    }

    if (this.customHandler) {
      return this.customHandler(request);
    }

    // Default intelligent mock generator for tests when no override is set
    const userPrompt = request.userPrompt;
    const lower = userPrompt.toLowerCase();

    // Check for injection keywords to simulate an adversarial LLM echoing user text
    if (lower.includes('drop table')) {
      return {
        content: JSON.stringify({
          sql: 'DROP TABLE dataset_table;',
          chartType: 'BAR',
          xField: 'name',
          yField: 'id',
          title: 'Adversarial Drop Table'
        }),
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140,
        model: 'mock-llm-v1',
        provider: this.providerName
      };
    }

    if (lower.includes('secret_passwords') || lower.includes('users_table')) {
      return {
        content: JSON.stringify({
          sql: 'SELECT * FROM secret_passwords',
          chartType: 'TABLE',
          xField: 'username',
          yField: 'password',
          title: 'Secret Passwords'
        }),
        promptTokens: 90,
        completionTokens: 35,
        totalTokens: 125,
        model: 'mock-llm-v1',
        provider: this.providerName
      };
    }

    // Generate valid DuckDB SQL based on typical queries
    let chartType = 'BAR';
    if (lower.includes('trend') || lower.includes('monthly') || lower.includes('growth')) {
      chartType = 'LINE';
    } else if (lower.includes('share') || lower.includes('breakdown') || lower.includes('distribution')) {
      chartType = 'DONUT';
    } else if (lower.includes('total') && !lower.includes('by') && !lower.includes('per')) {
      chartType = 'KPI';
    }

    // Determine target dimension and metric from prompt or schema
    let xField = 'department';
    let yField = 'total_amount';
    let sql = 'SELECT department, SUM(amount) AS total_amount FROM dataset_table GROUP BY department ORDER BY total_amount DESC LIMIT 500';

    if (lower.includes('salary') || lower.includes('spend')) {
      xField = 'department';
      yField = 'avg_salary';
      sql = 'SELECT department, AVG(salary) AS avg_salary FROM dataset_table GROUP BY department ORDER BY avg_salary DESC LIMIT 500';
    } else if (lower.includes('region') || lower.includes('country') || lower.includes('sales')) {
      xField = 'region';
      yField = 'total_sales';
      sql = 'SELECT region, SUM(amount) AS total_sales FROM dataset_table GROUP BY region ORDER BY total_sales DESC LIMIT 500';
    } else if (lower.includes('status') || lower.includes('active')) {
      xField = 'status';
      yField = 'count_records';
      sql = 'SELECT status, COUNT(*) AS count_records FROM dataset_table GROUP BY status ORDER BY count_records DESC LIMIT 500';
    }

    return {
      content: JSON.stringify({
        sql,
        chartType,
        xField,
        yField,
        title: `Analysis: ${userPrompt.slice(0, 40).trim()}`
      }),
      promptTokens: 150,
      completionTokens: 60,
      totalTokens: 210,
      model: 'mock-llm-v1',
      provider: this.providerName
    };
  }
}
