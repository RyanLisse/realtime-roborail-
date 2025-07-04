import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGService } from '../../../lib/openai/rag';
import { RAGError } from '../../../lib/openai/types';

// Define mockOpenAI before using it
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'test-completion-id',
        choices: [
          {
            message: {
              content: 'Test response with citation 【source:test.pdf】',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        model: 'gpt-4o-mock'
      }),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
  OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
}));

describe('RAGService', () => {
  let ragService: RAGService;

  beforeEach(() => {
    // Reset mocks
    if (mockOpenAI.chat.completions.create.mockClear) {
      mockOpenAI.chat.completions.create.mockClear();
    }
    // Reset default response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      id: 'test-completion-id',
      choices: [
        {
          message: {
            content: 'Test response with citation 【source:test.pdf】',
          },
        },
      ],
    });
    
    ragService = new RAGService({
      apiKey: 'test-api-key',
      vectorStoreId: 'test-vector-store-id',
    });
  });

  describe('initialization', () => {
    it('should initialize with required configuration', () => {
      expect(ragService).toBeInstanceOf(RAGService);
    });

    it('should throw error without API key', () => {
      expect(() => new RAGService({
        apiKey: '',
        vectorStoreId: 'test-vector-store-id',
      })).toThrow(RAGError);
    });

    it('should throw error without vector store ID', () => {
      expect(() => new RAGService({
        apiKey: 'test-api-key',
        vectorStoreId: '',
      })).toThrow(RAGError);
    });
  });

  describe('generateResponse', () => {
    it('should generate response with citations', async () => {
      const messages = [{ role: 'user' as const, content: 'What is RoboRail?' }];
      
      const result = await ragService.generateResponse({ messages });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          { role: 'user', content: 'What is RoboRail?' }
        ]),
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'file_search',
            file_search: {
              vector_store_ids: ['test-vector-store-id'],
            },
          })
        ]),
        temperature: 0.7,
        max_tokens: 1000,
      });

      expect(result).toEqual({
        text: 'Test response with citation [1]',
        citations: [
          {
            id: 1,
            fileId: 'file-test-pdf',
            quote: 'Content from test.pdf',
            originalText: '【source:test.pdf】',
            filename: undefined,
            pageNumber: undefined,
          }
        ],
        rawResponse: expect.any(Object),
      });
    });

    it('should generate response without citations when disabled', async () => {
      // Update mock to return response without citation text
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        id: 'test-completion-id',
        choices: [
          {
            message: {
              content: 'RoboRail is a railway system without citations.',
            },
          },
        ],
      });

      const messages = [{ role: 'user' as const, content: 'What is RoboRail?' }];
      
      const result = await ragService.generateResponse({ 
        messages, 
        enableCitations: false 
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          { role: 'user', content: 'What is RoboRail?' }
        ]),
        tools: undefined,
        temperature: 0.7,
        max_tokens: 1000,
      });

      expect(result.citations).toHaveLength(0);
    });

    it('should handle custom vector store ID', async () => {
      const messages = [{ role: 'user' as const, content: 'Test question' }];
      const customVectorStoreId = 'custom-vector-store-id';
      
      await ragService.generateResponse({ 
        messages, 
        vectorStoreId: customVectorStoreId 
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.any(Array),
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'file_search',
            file_search: {
              vector_store_ids: [customVectorStoreId],
            },
          })
        ]),
        temperature: 0.7,
        max_tokens: 1000,
      });
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(
        ragService.generateResponse({ 
          messages: [{ role: 'user', content: 'Test' }] 
        })
      ).rejects.toThrow(RAGError);
    });
  });

  describe('searchDocuments', () => {
    it('should search documents in vector store', async () => {
      const query = 'RoboRail documentation';
      
      const results = await ragService.searchDocuments(query);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          { role: 'user', content: query }
        ]),
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'file_search',
            file_search: {
              vector_store_ids: ['test-vector-store-id'],
            },
          })
        ]),
        temperature: 0,
        max_tokens: 500,
      });

      expect(results).toEqual([
        {
          id: 1,
          fileId: 'file-test-pdf',
          quote: 'Content from test.pdf',
          originalText: '【source:test.pdf】',
          filename: undefined,
          pageNumber: undefined,
        }
      ]);
    });

    it('should handle empty search results', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        id: 'test-completion-id',
        choices: [{ message: { content: 'No results found' } }],
      });

      const results = await ragService.searchDocuments('nonexistent query');

      expect(results).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', async () => {
      const customRAG = new RAGService({
        apiKey: 'test-api-key',
        vectorStoreId: 'test-vector-store-id',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000,
      });

      await customRAG.generateResponse({ 
        messages: [{ role: 'user', content: 'Test' }] 
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.any(Array),
        tools: expect.any(Array),
        temperature: 0.5,
        max_tokens: 2000,
      });
    });
  });
});