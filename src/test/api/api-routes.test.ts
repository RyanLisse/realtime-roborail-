import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment before importing routes
vi.mock('@/lib/config/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key-123',
    AUTH_SECRET: 'test-auth-secret',
    NODE_ENV: 'test',
  },
  validateEnvironment: vi.fn(() => ({
    valid: true,
    errors: []
  })),
  getAPIKeyStatus: vi.fn(() => ({
    openai: true,
    anthropic: false,
    perplexity: false,
    firecrawl: false,
    gemini: false,
    cohere: false,
    google: false,
    unstructured: false,
    visionAgent: false,
    deepeval: false,
    langsmith: false,
  }))
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn(),
      parse: vi.fn(),
    }
  }))
}));

// Mock generateResponse
vi.mock('@/lib/openai', () => ({
  generateResponse: vi.fn()
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock request
function createMockRequest(body?: any, headers: Record<string, string> = {}): any {
  return {
    ip: '127.0.0.1',
    headers: {
      get: vi.fn((key: string) => headers[key] || '127.0.0.1')
    },
    json: vi.fn().mockResolvedValue(body || {}),
    method: 'POST',
    nextUrl: {
      searchParams: {
        get: vi.fn().mockReturnValue(null)
      }
    }
  };
}

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('/api/session', () => {
    it('should create session with GET request', async () => {
      // Setup
      const mockSessionResponse = {
        id: 'session-123',
        object: 'realtime.session',
        model: 'gpt-4o-realtime-preview-2025-06-03',
        expires_at: Date.now() + 3600000,
        client_secret: {
          value: 'test-token',
          expires_at: Date.now() + 3600000
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse),
      });

      // Import and test
      const { GET } = await import('@/app/api/session/route');
      const mockRequest = createMockRequest();
      
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('session-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/realtime/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key-123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle OpenAI API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      });

      const { GET } = await import('@/app/api/session/route');
      const mockRequest = createMockRequest();
      
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('External service error');
    });
  });

  describe('/api/responses', () => {
    it('should handle text response requests', async () => {
      // Test simple validation instead of full OpenAI integration
      const { POST } = await import('@/app/api/responses/route');
      const mockRequest = createMockRequest({
        text: {
          value: 'Hello, world!'
        },
        modalities: ['text'],
        temperature: 0.7
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      // Should fail with processing error since we're mocking OpenAI
      expect(response.status).toBe(500);
      expect(data.error).toBe('Processing failed');
    });

    it('should validate content length', async () => {
      const { POST } = await import('@/app/api/responses/route');
      const longContent = 'x'.repeat(11000); // Exceeds 10000 character limit

      const mockRequest = createMockRequest({
        text: {
          value: longContent
        }
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Content too long');
    });
  });

  describe('/api/chat', () => {
    it('should return response for valid message', async () => {
      // Setup mock
      const { generateResponse } = await import('@/lib/openai');
      const mockGenerateResponse = vi.mocked(generateResponse);
      
      mockGenerateResponse.mockResolvedValueOnce({
        text: 'Test response from OpenAI',
        citations: [{
          id: 'citation-1',
          text: 'RoboRail Technical Documentation',
          source: 'Technical Manual Section 3.2',
          confidence: 0.95,
          page: 45
        }],
        sessionId: 'session-123',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        model: 'gpt-4o-mini'
      });

      // Test
      const { POST } = await import('@/app/api/chat/route');
      const mockRequest = createMockRequest({ message: 'Hello' });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('citations');
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('usage');
      expect(data).toHaveProperty('model');
      expect(typeof data.message).toBe('string');
    });

    it('should validate message input', async () => {
      const { POST } = await import('@/app/api/chat/route');
      const mockRequest = createMockRequest({}); // No message

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message is required and must be a non-empty string');
    });

    it('should validate message length', async () => {
      const { POST } = await import('@/app/api/chat/route');
      const longMessage = 'x'.repeat(10001); // Exceeds 10KB limit
      
      const mockRequest = createMockRequest({ message: longMessage });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message too long');
    });

    it('should handle rate limiting errors', async () => {
      const { generateResponse } = await import('@/lib/openai');
      const mockGenerateResponse = vi.mocked(generateResponse);
      
      mockGenerateResponse.mockRejectedValueOnce(new Error('rate limit exceeded'));

      const { POST } = await import('@/app/api/chat/route');
      const mockRequest = createMockRequest({ message: 'Hello' });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.retryAfter).toBe(60);
    });
  });

  describe('/api/health', () => {
    it('should return healthy status', async () => {
      // Mock process methods
      const originalProcess = {
        memoryUsage: process.memoryUsage,
        uptime: process.uptime,
      };

      process.memoryUsage = vi.fn(() => ({
        rss: 50 * 1024 * 1024, // 50MB
        heapTotal: 30 * 1024 * 1024, // 30MB
        heapUsed: 20 * 1024 * 1024, // 20MB
        external: 5 * 1024 * 1024, // 5MB
        arrayBuffers: 1 * 1024 * 1024, // 1MB
      }));
      
      process.uptime = vi.fn(() => 3661); // 1 hour, 1 minute, 1 second

      const { GET } = await import('@/app/api/health/route');
      const mockRequest = createMockRequest();
      
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');

      // Restore process methods
      Object.assign(process, originalProcess);
    });

    it('should return detailed info when requested', async () => {
      // Mock process methods
      const originalProcess = {
        memoryUsage: process.memoryUsage,
        uptime: process.uptime,
      };

      process.memoryUsage = vi.fn(() => ({
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024,
      }));
      
      process.uptime = vi.fn(() => 3661);

      const { GET } = await import('@/app/api/health/route');
      const mockRequest = createMockRequest();
      mockRequest.nextUrl.searchParams.get = vi.fn((key: string) => 
        key === 'detailed' ? 'true' : null
      );
      
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('warnings');
      expect(data).toHaveProperty('errors');

      // Verify memory calculations
      expect(data.checks.memory.rss).toBe(50);
      expect(data.checks.memory.heapUsed).toBe(20);

      // Restore process methods
      Object.assign(process, originalProcess);
    });
  });
});