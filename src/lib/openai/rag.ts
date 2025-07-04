import { OpenAIClient } from './client';
import { CitationUtils } from './citations';
import { 
  RAGError, 
  GenerateResponseParams, 
  GenerateResponseResult, 
  Citation,
  RAGConfig 
} from './types';

export interface RAGServiceConfig {
  apiKey: string;
  vectorStoreId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableCitations?: boolean;
}

export class RAGService {
  private client: OpenAIClient;
  private config: RAGConfig;

  constructor(config: RAGServiceConfig) {
    if (!config.apiKey) {
      throw new RAGError('API key is required');
    }
    
    if (!config.vectorStoreId) {
      throw new RAGError('Vector store ID is required');
    }

    this.config = {
      vectorStoreId: config.vectorStoreId,
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      enableCitations: config.enableCitations !== false,
    };

    this.client = new OpenAIClient({
      apiKey: config.apiKey,
      defaultModel: this.config.model,
      defaultTemperature: this.config.temperature,
      defaultMaxTokens: this.config.maxTokens,
    });
  }

  async generateResponse(params: GenerateResponseParams): Promise<GenerateResponseResult> {
    const {
      messages,
      vectorStoreId = this.config.vectorStoreId,
      enableCitations = this.config.enableCitations,
    } = params;

    try {
      const response = await this.client.createResponse(messages, {
        vectorStoreId,
        enableFileSearch: enableCitations,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      const parsedResponse = CitationUtils.parseCitations(
        response.output.text,
        response.annotations
      );

      return {
        text: parsedResponse.text,
        citations: parsedResponse.citations,
        rawResponse: response,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new RAGError(`Failed to generate response: ${error.message}`, error);
      }
      throw new RAGError('Failed to generate response: Unknown error');
    }
  }

  async searchDocuments(query: string, limit = 5): Promise<Citation[]> {
    try {
      const response = await this.client.createResponse([
        { role: 'user', content: query }
      ], {
        vectorStoreId: this.config.vectorStoreId,
        enableFileSearch: true,
        temperature: 0, // Lower temperature for search
        maxTokens: 500, // Shorter responses for search
      });

      const parsedResponse = CitationUtils.parseCitations(
        response.output.text,
        response.annotations
      );

      return parsedResponse.citations.slice(0, limit);
    } catch (error) {
      if (error instanceof Error) {
        throw new RAGError(`Failed to search documents: ${error.message}`, error);
      }
      throw new RAGError('Failed to search documents: Unknown error');
    }
  }

  async getVectorStoreInfo(): Promise<{ id: string; name: string; fileCount: number }> {
    try {
      // This would typically call the OpenAI API to get vector store info
      // For now, return basic info
      return {
        id: this.config.vectorStoreId,
        name: 'Vector Store',
        fileCount: 0,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new RAGError(`Failed to get vector store info: ${error.message}`, error);
      }
      throw new RAGError('Failed to get vector store info: Unknown error');
    }
  }

  updateConfiguration(updates: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfiguration(): RAGConfig {
    return { ...this.config };
  }
}