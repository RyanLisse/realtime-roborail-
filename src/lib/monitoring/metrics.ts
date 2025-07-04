import { env } from '../config/env';
import { logger } from './logger';

interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private enabled: boolean;

  constructor() {
    this.enabled = env.MONITORING_ENABLED || false;
  }

  // Record a counter metric (e.g., requests, errors)
  counter(name: string, value: number = 1, tags?: Record<string, string>) {
    if (!this.enabled) return;
    
    this.record({
      name: `counter.${name}`,
      value,
      unit: 'count',
      tags,
    });
  }

  // Record a gauge metric (e.g., active sessions, memory usage)
  gauge(name: string, value: number, tags?: Record<string, string>) {
    if (!this.enabled) return;
    
    this.record({
      name: `gauge.${name}`,
      value,
      unit: 'value',
      tags,
    });
  }

  // Record a histogram metric (e.g., response times, request sizes)
  histogram(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>) {
    if (!this.enabled) return;
    
    this.record({
      name: `histogram.${name}`,
      value,
      unit,
      tags,
    });
  }

  // Record a timing metric
  timing(name: string, duration: number, tags?: Record<string, string>) {
    this.histogram(name, duration, 'ms', tags);
  }

  private record(metric: MetricData) {
    const enrichedMetric = {
      ...metric,
      timestamp: new Date(),
      tags: {
        ...metric.tags,
        environment: env.NODE_ENV,
        service: 'realtime-agents',
      },
    };

    this.metrics.push(enrichedMetric);

    // Log metric for debugging
    logger.debug('Metric recorded', enrichedMetric);

    // In production, send to monitoring service
    if (env.NODE_ENV === 'production') {
      this.sendToMonitoringService(enrichedMetric);
    }

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private async sendToMonitoringService(metric: MetricData) {
    try {
      // Example: Send to DataDog, New Relic, or custom monitoring endpoint
      // await fetch('/api/metrics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metric),
      // });
    } catch (error) {
      logger.error('Failed to send metric to monitoring service', { 
        metric: metric.name, 
        error 
      });
    }
  }

  // Get current metrics (for debugging or health checks)
  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  // Clear metrics
  clear() {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();

// Middleware for automatic API metrics
export function withMetrics<T extends (...args: any[]) => any>(
  fn: T,
  metricName: string
): T {
  return ((...args: any[]) => {
    const start = Date.now();
    
    // Increment request counter
    metrics.counter(`${metricName}.requests`);

    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then((res) => {
            const duration = Date.now() - start;
            metrics.timing(`${metricName}.duration`, duration);
            metrics.counter(`${metricName}.success`);
            return res;
          })
          .catch((err) => {
            const duration = Date.now() - start;
            metrics.timing(`${metricName}.duration`, duration);
            metrics.counter(`${metricName}.error`, 1, {
              error_type: err.name || 'unknown',
            });
            throw err;
          });
      }
      
      const duration = Date.now() - start;
      metrics.timing(`${metricName}.duration`, duration);
      metrics.counter(`${metricName}.success`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      metrics.timing(`${metricName}.duration`, duration);
      metrics.counter(`${metricName}.error`, 1, {
        error_type: error instanceof Error ? error.name : 'unknown',
      });
      throw error;
    }
  }) as T;
}

// Application-specific metrics
export const appMetrics = {
  // Track OpenAI API usage
  openaiRequest: (model: string, tokens: number) => {
    metrics.counter('openai.requests', 1, { model });
    metrics.histogram('openai.tokens', tokens, 'tokens', { model });
  },

  // Track session lifecycle
  sessionCreated: () => metrics.counter('sessions.created'),
  sessionEnded: (duration: number) => {
    metrics.counter('sessions.ended');
    metrics.timing('sessions.duration', duration);
  },

  // Track user interactions
  userAction: (action: string) => {
    metrics.counter('user.actions', 1, { action });
  },

  // Track errors by type
  error: (type: string, endpoint?: string) => {
    metrics.counter('errors.total', 1, { type, endpoint });
  },

  // Track rate limiting
  rateLimitHit: (endpoint: string) => {
    metrics.counter('rate_limit.hits', 1, { endpoint });
  },

  // Track authentication events
  authEvent: (event: 'login' | 'logout' | 'failed_login', provider?: string) => {
    metrics.counter('auth.events', 1, { event, provider });
  },

  // Track deployment health
  healthCheck: (status: 'healthy' | 'unhealthy') => {
    metrics.gauge('health.status', status === 'healthy' ? 1 : 0);
  },
};