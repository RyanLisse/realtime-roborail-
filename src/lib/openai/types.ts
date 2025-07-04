import { z } from 'zod';

// OpenAI Response Types
export const OpenAIResponseSchema = z.object({
  id: z.string(),
  output: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  annotations: z.array(z.object({
    type: z.literal('file_citation'),
    text: z.string(),
    start_index: z.number(),
    end_index: z.number(),
    file_citation: z.object({
      file_id: z.string(),
      quote: z.string(),
    }),
  })),
});

export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

// Citation Types
export interface Citation {
  id: number;
  fileId: string;
  quote: string;
  originalText: string;
  filename?: string;
  pageNumber?: number;
}

export interface ParsedResponse {
  text: string;
  citations: Citation[];
}

// RAG Configuration
export interface RAGConfig {
  vectorStoreId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableCitations: boolean;
}

// Error Types
export class OpenAIError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RAGError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'RAGError';
  }
}

export class CitationError extends Error {
  constructor(message: string, public citationId?: number) {
    super(message);
    this.name = 'CitationError';
  }
}

// API Response Types
export interface GenerateResponseParams {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  vectorStoreId?: string;
  enableCitations?: boolean;
}

export interface GenerateResponseResult {
  text: string;
  citations: Citation[];
  rawResponse: OpenAIResponse;
}