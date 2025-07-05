import { vi } from 'vitest';
import { Citation } from '@/lib/openai/types';
import { SourceContent, GetSourceResponse } from '@/app/api/getSource/route';

/**
 * Mock citation data for testing
 */
export const mockCitations: Citation[] = [
  {
    id: 1,
    fileId: 'file-intro-123',
    quote: 'RoboRail is an advanced railway management system',
    originalText: '【source:intro.pdf】',
    filename: 'intro.pdf',
    pageNumber: 1,
  },
  {
    id: 2,
    fileId: 'file-safety-456',
    quote: 'Safety protocols must be followed at all times',
    originalText: '【source:safety-manual.pdf】',
    filename: 'safety-manual.pdf',
    pageNumber: 15,
  },
  {
    id: 3,
    fileId: 'file-operations-789',
    quote: 'Daily maintenance schedules are critical for optimal performance',
    originalText: '【source:operations-guide.pdf】',
    filename: 'operations-guide.pdf',
    pageNumber: 42,
  },
  {
    id: 4,
    fileId: 'file-technical-spec',
    quote: 'System specifications and requirements',
    originalText: '【source:technical-spec.txt】',
    filename: 'technical-spec.txt',
    // No page number for text files
  },
];

/**
 * Mock source content data for different file types
 */
export const mockSourceContents: Record<string, SourceContent> = {
  'file-intro-123': {
    fileId: 'file-intro-123',
    filename: 'intro.pdf',
    content: `RoboRail is an advanced railway management system designed to optimize train operations and enhance safety. The system provides real-time monitoring capabilities and automated decision-making features that help railway operators maintain efficient schedules while ensuring passenger safety.`,
    metadata: {
      pageNumber: 1,
      totalPages: 25,
      mimeType: 'application/pdf',
      size: 2048576, // 2MB
      createdAt: '2023-01-15T10:30:00.000Z',
    },
    context: {
      before: 'Welcome to the RoboRail documentation. This guide will help you understand the system capabilities.',
      after: 'The following sections will detail the installation process and configuration options.',
      startLine: 5,
      endLine: 8,
    },
  },
  'file-safety-456': {
    fileId: 'file-safety-456',
    filename: 'safety-manual.pdf',
    content: `Safety protocols must be followed at all times when operating RoboRail systems. Personnel must be trained in emergency procedures and wear appropriate protective equipment. Regular safety inspections are mandatory.`,
    metadata: {
      pageNumber: 15,
      totalPages: 150,
      mimeType: 'application/pdf',
      size: 5242880, // 5MB
      createdAt: '2023-02-01T14:15:00.000Z',
    },
    context: {
      before: 'Chapter 3: Safety Procedures\n\nThis chapter outlines the essential safety requirements.',
      after: 'Failure to comply with these protocols may result in system shutdown and investigation.',
      startLine: 412,
      endLine: 415,
    },
  },
  'file-operations-789': {
    fileId: 'file-operations-789',
    filename: 'operations-guide.pdf',
    content: `Daily maintenance schedules are critical for optimal performance of the RoboRail system. Maintenance tasks include track inspection, signal testing, and system diagnostics. All maintenance activities must be logged and reported.`,
    metadata: {
      pageNumber: 42,
      totalPages: 200,
      mimeType: 'application/pdf',
      size: 7340032, // 7MB
      createdAt: '2023-03-10T09:00:00.000Z',
    },
    context: {
      before: 'Section 5.2: Preventive Maintenance\n\nPreventive maintenance is essential for system reliability.',
      after: 'The next section covers troubleshooting common issues and corrective actions.',
      startLine: 1156,
      endLine: 1159,
    },
  },
  'file-technical-spec': {
    fileId: 'file-technical-spec',
    filename: 'technical-spec.txt',
    content: `System specifications and requirements:
- Operating System: Linux 20.04 LTS or later
- Memory: Minimum 16GB RAM, Recommended 32GB
- Storage: 1TB SSD for optimal performance
- Network: Gigabit Ethernet connection required
- Database: PostgreSQL 13+ or MySQL 8+`,
    metadata: {
      mimeType: 'text/plain',
      size: 512, // 512 bytes
      createdAt: '2023-04-05T16:45:00.000Z',
    },
    context: {
      before: '# RoboRail Technical Specifications\n\nThis document outlines the technical requirements.',
      after: '\n## Software Dependencies\n\nThe following software packages are required:',
      startLine: 10,
      endLine: 16,
    },
  },
};

/**
 * Mock successful API responses
 */
export const createMockGetSourceResponse = (
  fileId: string,
  success: boolean = true
): GetSourceResponse => {
  if (!success) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File not found or access denied',
      },
    };
  }

  const sourceContent = mockSourceContents[fileId];
  if (!sourceContent) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
      },
    };
  }

  return {
    success: true,
    data: sourceContent,
  };
};

/**
 * Mock OpenAI file metadata
 */
export const mockOpenAIFileMetadata = {
  'file-intro-123': {
    id: 'file-intro-123',
    filename: 'intro.pdf',
    bytes: 2048576,
    created_at: 1673776200, // 2023-01-15T10:30:00Z
    object: 'file' as const,
    purpose: 'assistants',
  },
  'file-safety-456': {
    id: 'file-safety-456',
    filename: 'safety-manual.pdf',
    bytes: 5242880,
    created_at: 1675261300, // 2023-02-01T14:15:00Z
    object: 'file' as const,
    purpose: 'assistants',
  },
  'file-operations-789': {
    id: 'file-operations-789',
    filename: 'operations-guide.pdf',
    bytes: 7340032,
    created_at: 1678434000, // 2023-03-10T09:00:00Z
    object: 'file' as const,
    purpose: 'assistants',
  },
  'file-technical-spec': {
    id: 'file-technical-spec',
    filename: 'technical-spec.txt',
    bytes: 512,
    created_at: 1680714300, // 2023-04-05T16:45:00Z
    object: 'file' as const,
    purpose: 'assistants',
  },
};

/**
 * Mock OpenAI responses with citations
 */
export const mockOpenAIResponses = {
  withSingleCitation: {
    id: 'response-single',
    output: {
      type: 'text' as const,
      text: 'RoboRail is an advanced railway system 【source:intro.pdf】 for modern transportation.',
    },
    annotations: [
      {
        type: 'file_citation' as const,
        text: '【source:intro.pdf】',
        start_index: 35,
        end_index: 56,
        file_citation: {
          file_id: 'file-intro-123',
          quote: 'RoboRail is an advanced railway management system',
        },
      },
    ],
  },
  withMultipleCitations: {
    id: 'response-multiple',
    output: {
      type: 'text' as const,
      text: 'RoboRail provides safety features 【source:safety-manual.pdf】 and requires maintenance 【source:operations-guide.pdf】.',
    },
    annotations: [
      {
        type: 'file_citation' as const,
        text: '【source:safety-manual.pdf】',
        start_index: 35,
        end_index: 62,
        file_citation: {
          file_id: 'file-safety-456',
          quote: 'Safety protocols must be followed at all times',
        },
      },
      {
        type: 'file_citation' as const,
        text: '【source:operations-guide.pdf】',
        start_index: 85,
        end_index: 114,
        file_citation: {
          file_id: 'file-operations-789',
          quote: 'Daily maintenance schedules are critical for optimal performance',
        },
      },
    ],
  },
  withoutCitations: {
    id: 'response-no-citations',
    output: {
      type: 'text' as const,
      text: 'This is a general response without any citations.',
    },
    annotations: [],
  },
};

/**
 * Mock fetch function for API calls
 */
export const createMockFetch = (responses: Record<string, any> = {}) => {
  return vi.fn((url: string, options?: RequestInit) => {
    const urlObj = new URL(url, 'http://localhost:3000');
    
    if (urlObj.pathname === '/api/getSource') {
      const fileId = urlObj.searchParams.get('fileId');
      const response = responses[fileId!] || createMockGetSourceResponse(fileId!);
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
        headers: new Headers(),
        status: 200,
        statusText: 'OK',
      });
    }

    // Default response for unknown endpoints
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
      headers: new Headers(),
      status: 404,
      statusText: 'Not Found',
    });
  });
};

/**
 * Mock OpenAI client for citations
 */
export const createMockOpenAIClient = () => ({
  files: {
    retrieve: vi.fn((fileId: string) => {
      const metadata = mockOpenAIFileMetadata[fileId as keyof typeof mockOpenAIFileMetadata];
      if (!metadata) {
        throw new Error('No such file');
      }
      return Promise.resolve(metadata);
    }),
    content: vi.fn((fileId: string) => {
      const content = mockSourceContents[fileId];
      if (!content) {
        throw new Error('No such file');
      }
      return Promise.resolve({
        text: () => Promise.resolve(content.content),
      });
    }),
  },
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue(mockOpenAIResponses.withSingleCitation),
    },
  },
});

/**
 * Utility to create citation test scenarios
 */
export const citationTestScenarios = {
  singleCitation: {
    citation: mockCitations[0],
    sourceContent: mockSourceContents['file-intro-123'],
    apiResponse: createMockGetSourceResponse('file-intro-123'),
  },
  multipleCitations: {
    citations: [mockCitations[0], mockCitations[1]],
    sourceContents: [
      mockSourceContents['file-intro-123'],
      mockSourceContents['file-safety-456'],
    ],
  },
  citationWithoutPage: {
    citation: mockCitations[3], // technical-spec.txt without page number
    sourceContent: mockSourceContents['file-technical-spec'],
    apiResponse: createMockGetSourceResponse('file-technical-spec'),
  },
  nonExistentFile: {
    citation: {
      id: 99,
      fileId: 'file-nonexistent',
      quote: 'This file does not exist',
      originalText: '【source:nonexistent.pdf】',
    },
    apiResponse: createMockGetSourceResponse('file-nonexistent', false),
  },
  networkError: {
    citation: mockCitations[0],
    error: new Error('Network connection failed'),
  },
  serverError: {
    citation: mockCitations[0],
    apiResponse: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
  },
};

/**
 * Reset all mocks to default state
 */
export const resetCitationMocks = () => {
  vi.clearAllMocks();
};

/**
 * Helper to wait for async operations in tests
 */
export const waitForAsyncUpdate = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock environment variables for testing
 */
export const mockEnvVars = {
  OPENAI_API_KEY: 'sk-test-1234567890abcdef1234567890abcdef1234567890abcdef',
  VECTOR_STORE_ID: 'test-vector-store-id',
  AUTH_SECRET: 'test-auth-secret-for-testing-purposes-only-must-be-32-chars',
};

/**
 * Format file size helper for testing
 */
export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export default {
  mockCitations,
  mockSourceContents,
  createMockGetSourceResponse,
  mockOpenAIFileMetadata,
  mockOpenAIResponses,
  createMockFetch,
  createMockOpenAIClient,
  citationTestScenarios,
  resetCitationMocks,
  waitForAsyncUpdate,
  mockEnvVars,
  formatFileSize,
};