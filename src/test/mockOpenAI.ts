import { vi } from 'vitest';

export const mockOpenAIResponse = {
  id: 'test-response-id',
  output: {
    type: 'text',
    text: 'Test response with citation 【source:test.pdf】',
  },
  annotations: [
    {
      type: 'file_citation',
      text: '【source:test.pdf】',
      start_index: 23,
      end_index: 44,
      file_citation: {
        file_id: 'test-file-id',
        quote: 'Test quote from document',
      },
    },
  ],
};

export const mockOpenAI = {
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
  responses: {
    create: vi.fn().mockResolvedValue(mockOpenAIResponse),
  },
  vectorStores: {
    create: vi.fn().mockResolvedValue({
      id: 'test-vector-store-id',
      name: 'Test Vector Store',
    }),
    files: {
      create: vi.fn().mockResolvedValue({
        id: 'test-file-id',
        filename: 'test.pdf',
      }),
    },
  },
};

// Export for tests that expect mockOpenAIClient
export const mockOpenAIClient = mockOpenAI;

// Add default export for OpenAI constructor mock
export const OpenAIMock = vi.fn().mockImplementation(() => mockOpenAI);

export const resetMocks = () => {
  // Reset chat completion mocks
  if (mockOpenAI.chat.completions.create && mockOpenAI.chat.completions.create.mockClear) {
    mockOpenAI.chat.completions.create.mockClear();
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
  }
  
  // Reset response mocks
  Object.values(mockOpenAI.responses).forEach(mock => {
    if (typeof mock === 'function' && mock.mockClear) {
      mock.mockClear();
    }
  });
  
  // Reset vector store mocks
  if (mockOpenAI.vectorStores.create && mockOpenAI.vectorStores.create.mockClear) {
    mockOpenAI.vectorStores.create.mockClear();
  }
  
  if (mockOpenAI.vectorStores.files.create && mockOpenAI.vectorStores.files.create.mockClear) {
    mockOpenAI.vectorStores.files.create.mockClear();
  }

  // Reset OpenAI constructor mock
  if (OpenAIMock.mockClear) {
    OpenAIMock.mockClear();
  }
};