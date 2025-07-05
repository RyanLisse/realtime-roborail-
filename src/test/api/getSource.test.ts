import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/getSource/route';

// Mock dependencies
vi.mock('@/lib/openai/client', () => ({
  openai: {
    files: {
      retrieve: vi.fn(),
      content: vi.fn(),
    },
  },
}));

vi.mock('@/lib/security/rateLimit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/auth/config', () => ({
  validateAPIKey: vi.fn(),
}));

import { openai } from '@/lib/openai/client';
import { rateLimit } from '@/lib/security/rateLimit';
import { validateAPIKey } from '@/lib/auth/config';

describe('/api/getSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful mocks
    (rateLimit as any).mockResolvedValue({ success: true });
    (validateAPIKey as any).mockReturnValue({ valid: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    const createRequest = (params: Record<string, string> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
      
      const url = `http://localhost:3000/api/getSource?${searchParams.toString()}`;
      
      return new NextRequest(url, {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });
    };

    it('should return source content successfully', async () => {
      const mockFileMetadata = {
        id: 'file-123',
        filename: 'test-document.pdf',
        bytes: 1024,
        created_at: 1640995200, // 2022-01-01
        object: 'file',
      };

      const mockFileContent = {
        text: vi.fn().mockResolvedValue('This is test content from the document.\nIt has multiple lines.\nWith more information here.'),
      };

      (openai.files.retrieve as any).mockResolvedValue(mockFileMetadata);
      (openai.files.content as any).mockResolvedValue(mockFileContent);

      const request = createRequest({
        fileId: 'file-123',
        contextLines: '2',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          fileId: 'file-123',
          filename: 'test-document.pdf',
          content: 'This is test content from the document.\nIt has multiple lines.\nWith more information here.',
          metadata: {
            pageNumber: undefined,
            mimeType: 'text/plain',
            size: 1024,
            createdAt: '2022-01-01T00:00:00.000Z',
          },
          context: undefined,
        },
      });
    });

    it('should handle page number parameter', async () => {
      const mockFileMetadata = {
        id: 'file-123',
        filename: 'test-document.pdf',
        bytes: 1024,
        created_at: 1640995200,
        object: 'file',
      };

      const mockContent = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');
      const mockFileContent = {
        text: vi.fn().mockResolvedValue(mockContent),
      };

      (openai.files.retrieve as any).mockResolvedValue(mockFileMetadata);
      (openai.files.content as any).mockResolvedValue(mockFileContent);

      const request = createRequest({
        fileId: 'file-123',
        pageNumber: '2',
        contextLines: '1',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.metadata.pageNumber).toBe(2);
      expect(data.data.context).toBeDefined();
      expect(data.data.context.startLine).toBe(51);
      expect(data.data.context.endLine).toBe(100);
    });

    it('should handle character range parameters', async () => {
      const mockFileMetadata = {
        id: 'file-123',
        filename: 'test-document.pdf',
        bytes: 1024,
        created_at: 1640995200,
        object: 'file',
      };

      const mockFileContent = {
        text: vi.fn().mockResolvedValue('This is a long document with specific content that we want to extract from specific character positions.'),
      };

      (openai.files.retrieve as any).mockResolvedValue(mockFileMetadata);
      (openai.files.content as any).mockResolvedValue(mockFileContent);

      const request = createRequest({
        fileId: 'file-123',
        startChar: '10',
        endChar: '30',
        contextLines: '2',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.content).toBe('a long document wi');
      expect(data.data.context).toBeDefined();
      expect(data.data.context.before).toBeDefined();
      expect(data.data.context.after).toBeDefined();
    });

    it('should return 401 for missing authorization header', async () => {
      const url = 'http://localhost:3000/api/getSource?fileId=file-123';
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    });

    it('should return 401 for invalid API key', async () => {
      (validateAPIKey as any).mockReturnValue({ valid: false });

      const request = createRequest({ fileId: 'file-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      });
    });

    it('should return 429 for rate limit exceeded', async () => {
      (rateLimit as any).mockResolvedValue({ success: false });

      const request = createRequest({ fileId: 'file-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      });
    });

    it('should return 400 for missing fileId parameter', async () => {
      const url = 'http://localhost:3000/api/getSource';
      const request = new NextRequest(url, {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for file not found', async () => {
      (openai.files.retrieve as any).mockResolvedValue(null);

      const request = createRequest({ fileId: 'non-existent-file' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found or access denied',
        },
      });
    });

    it('should handle OpenAI API errors gracefully', async () => {
      (openai.files.retrieve as any).mockRejectedValue(new Error('No such file'));

      const request = createRequest({ fileId: 'file-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found in OpenAI storage',
        },
      });
    });

    it('should handle permission errors', async () => {
      (openai.files.retrieve as any).mockRejectedValue(new Error('insufficient permission'));

      const request = createRequest({ fileId: 'file-123' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Insufficient permissions to access file',
        },
      });
    });

    it('should validate contextLines parameter bounds', async () => {
      const request = createRequest({
        fileId: 'file-123',
        contextLines: '25', // Above max of 20
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST', () => {
    const createPostRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/getSource', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-api-key',
        },
        body: JSON.stringify(body),
      });
    };

    it('should handle single file request', async () => {
      const mockFileMetadata = {
        id: 'file-123',
        filename: 'test-document.pdf',
        bytes: 1024,
        created_at: 1640995200,
        object: 'file',
      };

      const mockFileContent = {
        text: vi.fn().mockResolvedValue('Test content'),
      };

      (openai.files.retrieve as any).mockResolvedValue(mockFileMetadata);
      (openai.files.content as any).mockResolvedValue(mockFileContent);

      const request = createPostRequest({
        fileId: 'file-123',
        contextLines: 2,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.filename).toBe('test-document.pdf');
    });

    it('should handle batch file requests', async () => {
      const mockFileMetadata1 = {
        id: 'file-123',
        filename: 'document1.pdf',
        bytes: 1024,
        created_at: 1640995200,
        object: 'file',
      };

      const mockFileMetadata2 = {
        id: 'file-456',
        filename: 'document2.pdf',
        bytes: 2048,
        created_at: 1640995300,
        object: 'file',
      };

      const mockFileContent1 = {
        text: vi.fn().mockResolvedValue('Content 1'),
      };

      const mockFileContent2 = {
        text: vi.fn().mockResolvedValue('Content 2'),
      };

      (openai.files.retrieve as any)
        .mockResolvedValueOnce(mockFileMetadata1)
        .mockResolvedValueOnce(mockFileMetadata2);
      
      (openai.files.content as any)
        .mockResolvedValueOnce(mockFileContent1)
        .mockResolvedValueOnce(mockFileContent2);

      const request = createPostRequest({
        fileIds: ['file-123', 'file-456'],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sources).toHaveLength(2);
      expect(data.sources[0].filename).toBe('document1.pdf');
      expect(data.sources[1].filename).toBe('document2.pdf');
    });

    it('should handle partial failures in batch requests', async () => {
      const mockFileMetadata = {
        id: 'file-123',
        filename: 'document1.pdf',
        bytes: 1024,
        created_at: 1640995200,
        object: 'file',
      };

      const mockFileContent = {
        text: vi.fn().mockResolvedValue('Content 1'),
      };

      (openai.files.retrieve as any)
        .mockResolvedValueOnce(mockFileMetadata)
        .mockRejectedValueOnce(new Error('File not found'));
      
      (openai.files.content as any)
        .mockResolvedValueOnce(mockFileContent);

      const request = createPostRequest({
        fileIds: ['file-123', 'file-nonexistent'],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sources).toHaveLength(1);
      expect(data.sources[0].filename).toBe('document1.pdf');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/getSource', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-api-key',
        },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});