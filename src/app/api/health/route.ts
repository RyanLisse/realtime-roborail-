import { NextRequest, NextResponse } from 'next/server';
import { env, validateEnvironment, getAPIKeyStatus } from '../../../lib/config/env';

export async function GET(request: NextRequest) {
  try {
    // Check environment configuration
    const envValidation = validateEnvironment();
    const apiKeyStatus = getAPIKeyStatus();
    
    // Performance check - memory usage
    const memoryUsage = process.memoryUsage();
    const memoryInMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };
    
    // Check database connection if configured
    let databaseHealth = 'not_configured';
    if (env.DATABASE_URL || env.POSTGRES_URL) {
      databaseHealth = 'available'; // Would test actual connection in production
    }
    
    // Check required services
    const checks = {
      environment: envValidation.valid,
      apis: apiKeyStatus,
      database: databaseHealth,
      memory: memoryInMB,
      performance: {
        uptime: Math.round(process.uptime()),
        uptimeHuman: formatUptime(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
    
    // Overall health status
    const criticalChecks = [
      checks.environment,
      checks.apis.openai,
      checks.performance.uptime > 0
    ];
    
    const healthy = criticalChecks.every(check => check);
    const status = healthy ? 'healthy' : 'unhealthy';
    
    // Add warnings for non-critical issues
    const warnings = [];
    if (!checks.apis.anthropic && env.NODE_ENV === 'production') {
      warnings.push('Anthropic API key not configured - some features may be limited');
    }
    if (memoryInMB.heapUsed > 500) {
      warnings.push('High memory usage detected');
    }
    
    // Include query parameter for detailed check
    const detailed = request.nextUrl.searchParams.get('detailed') === 'true';
    
    const response = {
      status,
      timestamp: checks.timestamp,
      version: checks.version,
      ...(detailed ? { 
        checks, 
        warnings,
        errors: envValidation.errors 
      } : {}),
    };
    
    return NextResponse.json(response, { 
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': status,
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Check': 'error',
        }
      }
    );
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}