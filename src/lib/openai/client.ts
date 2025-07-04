import OpenAI from 'openai';
import { OpenAIResponse, OpenAIError, OpenAIResponseSchema } from './types';

export interface OpenAIClientConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface CreateResponseOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  vectorStoreId?: string;
  enableFileSearch?: boolean;
}

export class OpenAIClient {
  private client: OpenAI;
  private config: Required<Omit<OpenAIClientConfig, 'baseURL'>> & Pick<OpenAIClientConfig, 'baseURL'>;

  constructor(config: OpenAIClientConfig) {
    if (!config.apiKey) {
      throw new OpenAIError('API key is required');
    }

    this.config = {
      ...config,
      defaultModel: config.defaultModel || 'gpt-4o-mini',
      defaultTemperature: config.defaultTemperature || 0.7,
      defaultMaxTokens: config.defaultMaxTokens || 1000,
    };

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async createResponse(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: CreateResponseOptions = {}
  ): Promise<OpenAIResponse> {
    const {
      model = this.config.defaultModel,
      temperature = this.config.defaultTemperature,
      maxTokens = this.config.defaultMaxTokens,
      vectorStoreId,
      enableFileSearch = false,
    } = options;

    const tools = [];
    
    if (enableFileSearch && vectorStoreId) {
      tools.push({
        type: 'file_search' as const,
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      });
    }

    try {
      const response = await this.retryWithBackoff(async () => {
        const result = await this.client.chat.completions.create({
          model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          temperature,
          max_tokens: maxTokens,
        });

        // Transform the response to match our expected format
        const transformedResponse = {
          id: result.id,
          output: {
            type: 'text' as const,
            text: result.choices[0]?.message?.content || '',
          },
          annotations: this.extractAnnotations(result.choices[0]?.message?.content || ''),
        };

        return transformedResponse;
      });

      // Validate response structure
      return OpenAIResponseSchema.parse(response);
    } catch (error) {
      if (error instanceof Error) {
        throw new OpenAIError(`Failed to create response: ${error.message}`);
      }
      throw new OpenAIError('Failed to create response: Unknown error');
    }
  }

  private extractAnnotations(text: string): Array<{
    type: 'file_citation';
    text: string;
    start_index: number;
    end_index: number;
    file_citation: {
      file_id: string;
      quote: string;
    };
  }> {
    const annotations = [];
    
    // Pattern to match citation markers like 【source:filename】
    const citationPattern = /【source:([^】]+)】/g;
    let match;

    while ((match = citationPattern.exec(text)) !== null) {
      const [fullMatch, source] = match;
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      annotations.push({
        type: 'file_citation' as const,
        text: fullMatch,
        start_index: startIndex,
        end_index: endIndex,
        file_citation: {
          file_id: `file-${source.replace(/[^a-zA-Z0-9]/g, '-')}`,
          quote: `Content from ${source}`,
        },
      });
    }

    return annotations;
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on permanent errors
        if (this.isPermanentError(error)) {
          break;
        }

        // Don't retry on the last attempt
        if (attempt === maxRetries - 1) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private isPermanentError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('invalid api key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found')
    );
  }
}

// Export a shared OpenAI instance for the audio services
// This will use environment variables or throw an error in tests (where it's mocked)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
});