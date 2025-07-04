import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIClient } from '../../../lib/openai/client';
import { OpenAIError } from '../../../lib/openai/types';

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
  audio: {
    speech: {
      create: vi.fn().mockResolvedValue(new Blob(['mock audio'], { type: 'audio/wav' })),
    },
    transcriptions: {
      create: vi.fn().mockResolvedValue({
        text: 'Mock transcription'
      }),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
  OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
}));

describe('OpenAIClient', () => {
  let client: OpenAIClient;

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
    
    client = new OpenAIClient({
      apiKey: 'test-api-key',
    });
  });

  describe('initialization', () => {
    it('should initialize with API key', () => {
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('should throw error without API key', () => {
      expect(() => new OpenAIClient({ apiKey: '' })).toThrow(OpenAIError);
    });
  });

  describe('createResponse', () => {
    it('should create a response with file search', async () => {
      const messages = [{ role: 'user' as const, content: 'Test question' }];
      const vectorStoreId = 'test-vector-store-id';

      const response = await client.createResponse(messages, {
        vectorStoreId,
        enableFileSearch: true,
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          { role: 'user', content: 'Test question' }
        ]),
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'file_search',
            file_search: {
              vector_store_ids: [vectorStoreId],
            },
          })
        ]),
        temperature: 0.7,
        max_tokens: 1000,
      });

      expect(response).toEqual({
        id: 'test-completion-id',
        output: {
          type: 'text',
          text: 'Test response with citation 【source:test.pdf】',
        },
        annotations: expect.any(Array),
      });
    });

    it('should create a response without file search', async () => {
      const messages = [{ role: 'user' as const, content: 'Test question' }];

      const response = await client.createResponse(messages, {
        enableFileSearch: false,
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          { role: 'user', content: 'Test question' }
        ]),
        tools: undefined,
        temperature: 0.7,
        max_tokens: 1000,
      });

      expect(response).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(
        client.createResponse([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow(OpenAIError);
    });

    it('should support custom configuration', async () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];
      
      await client.createResponse(messages, {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 500,
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.any(Array),
        tools: undefined,
        temperature: 0.5,
        max_tokens: 500,
      });
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry on transient errors', async () => {
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValue({
          id: 'test-completion-id',
          choices: [{ message: { content: 'Success' } }],
        });

      const response = await client.createResponse([
        { role: 'user', content: 'Test' }
      ]);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
      expect(response.id).toBe('test-completion-id');
    });

    it('should not retry on permanent errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Invalid API key')
      );

      await expect(
        client.createResponse([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow(OpenAIError);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});