import { z } from 'zod';

// Input validation schemas
export const sessionRequestSchema = z.object({
  model: z.string().min(1),
  instructions: z.string().optional(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(4096).optional(),
});

export const responseRequestSchema = z.object({
  text: z.object({
    value: z.string().min(1),
    format: z.object({
      type: z.enum(['text', 'json_schema']),
      schema: z.object({}).optional(),
    }).optional(),
  }),
  modalities: z.array(z.enum(['text', 'audio'])).optional(),
  instructions: z.string().optional(),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  output_audio_format: z.enum(['pcm16', 'g711_ulaw', 'g711_alaw']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(4096).optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
  })).min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(4096).optional(),
  stream: z.boolean().optional(),
});

// Sanitization functions
export function sanitizeString(input: string): string {
  // Remove potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

export function sanitizeJSON(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeJSON);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeString(key)] = sanitizeJSON(value);
    }
    return sanitized;
  }
  
  return input;
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidAPIKey(apiKey: string): boolean {
  // OpenAI API key format
  const openaiRegex = /^sk-[a-zA-Z0-9]{48}$/;
  // OpenAI project key format
  const projectRegex = /^sk-proj-[a-zA-Z0-9_-]{64}$/;
  
  return openaiRegex.test(apiKey) || projectRegex.test(apiKey);
}

// Rate limiting validation
export function validateRateLimitHeaders(headers: Record<string, string>): boolean {
  const requiredHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];
  return requiredHeaders.every(header => headers[header] !== undefined);
}

// Content validation
export function validateContentLength(content: string, maxLength: number = 10000): boolean {
  return content.length <= maxLength;
}

export function validateContentType(contentType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(contentType);
}

// IP validation
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

export function isValidIPv6(ip: string): boolean {
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

// Security token validation
export function validateJWTStructure(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}