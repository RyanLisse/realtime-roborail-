import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_VECTORSTORE: z.string().optional(),
  
  // Authentication
  AUTH_SECRET: z.string().min(32, 'Auth secret must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Database
  DATABASE_URL: z.string().url('Invalid database URL').optional(),
  POSTGRES_URL: z.string().url('Invalid PostgreSQL URL').optional(),
  
  // Redis/Valkey
  VALKEY_URL: z.string().url('Invalid Valkey URL').optional(),
  
  // External APIs
  ANTHROPIC_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  UNSTRUCTURED_API_KEY: z.string().optional(),
  UNSTRUCTURED_API_URL: z.string().url().optional(),
  UNSTRUCTURED_WORKFLOW_URL: z.string().url().optional(),
  VISION_AGENT_API_KEY: z.string().optional(),
  DEEPEVAL_API_KEY: z.string().optional(),
  
  // Observability
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  LANGSMITH_TRACING: z.string().transform(val => val === 'true').optional(),
  
  // Model Configuration
  DEFAULT_CHAT_MODEL_ID: z.string().default('openai-gpt-4.1'),
  EMBEDDING_MODEL_COHERE: z.string().default('embed-v4.0'),
  
  // Security
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_ENABLED: z.string().transform(val => val === 'true').default('true'),
  
  // Deployment
  VERCEL_URL: z.string().optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),
  AWS_REGION: z.string().optional(),
  
  // Monitoring
  MONITORING_ENABLED: z.string().transform(val => val === 'true').default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Export environment variables with validation
export const env = envSchema.parse(process.env);

// Type for environment variables
export type Environment = z.infer<typeof envSchema>;

// Validation functions
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  try {
    envSchema.parse(process.env);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

// Environment checks
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}

// API key validation
export function hasRequiredAPIKeys(): boolean {
  return !!env.OPENAI_API_KEY && !!env.AUTH_SECRET;
}

export function getAPIKeyStatus(): Record<string, boolean> {
  return {
    openai: !!env.OPENAI_API_KEY,
    anthropic: !!env.ANTHROPIC_API_KEY,
    perplexity: !!env.PERPLEXITY_API_KEY,
    firecrawl: !!env.FIRECRAWL_API_KEY,
    gemini: !!env.GEMINI_API_KEY,
    cohere: !!env.COHERE_API_KEY,
    google: !!env.GOOGLE_API_KEY,
    unstructured: !!env.UNSTRUCTURED_API_KEY,
    visionAgent: !!env.VISION_AGENT_API_KEY,
    deepeval: !!env.DEEPEVAL_API_KEY,
    langsmith: !!env.LANGSMITH_API_KEY,
  };
}

// Database configuration
export function getDatabaseConfig() {
  return {
    url: env.DATABASE_URL || env.POSTGRES_URL,
    ssl: isProduction() ? { rejectUnauthorized: false } : false,
    connectionLimit: isProduction() ? 10 : 5,
  };
}

// Redis configuration
export function getRedisConfig() {
  return {
    url: env.VALKEY_URL,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  };
}

// CORS configuration
export function getCorsOrigins(): string[] {
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  if (isDevelopment()) {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  
  return [];
}

// Rate limiting configuration
export function getRateLimitConfig() {
  return {
    enabled: env.RATE_LIMIT_ENABLED,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: isDevelopment() ? 1000 : 100,
  };
}

// Monitoring configuration
export function getMonitoringConfig() {
  return {
    enabled: env.MONITORING_ENABLED,
    logLevel: env.LOG_LEVEL,
    langsmithEnabled: !!env.LANGSMITH_API_KEY && !!env.LANGSMITH_PROJECT,
  };
}