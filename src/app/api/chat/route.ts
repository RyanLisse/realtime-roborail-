import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/openai';
import { env } from '@/lib/config/env';
import { sanitizeString, validateContentLength } from '@/lib/security/validation';

export async function POST(request: NextRequest) {
  try {
    // Log security event
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    console.log(`[Security] Chat request from IP: ${clientIP}`);

    // Validate API key exists
    if (!env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, sessionId, model, temperature, max_tokens } = body;
    
    // Enhanced input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (sessionId && typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'SessionId must be a string if provided' },
        { status: 400 }
      );
    }

    // Validate content length (10KB limit)
    if (!validateContentLength(message, 10000)) {
      return NextResponse.json(
        { error: 'Message too long' },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedMessage = sanitizeString(message);
    const sanitizedSessionId = sessionId ? sanitizeString(sessionId) : undefined;

    // Validate optional parameters
    if (model && typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Model must be a string if provided' },
        { status: 400 }
      );
    }

    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: 'Temperature must be a number between 0 and 2' },
        { status: 400 }
      );
    }

    if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 4096)) {
      return NextResponse.json(
        { error: 'Max tokens must be a number between 1 and 4096' },
        { status: 400 }
      );
    }

    // Generate response using OpenAI RAG
    const result = await generateResponse({
      messages: [{ role: 'user', content: sanitizedMessage }],
      sessionId: sanitizedSessionId,
      model: model || undefined,
      temperature: temperature || undefined,
      maxTokens: max_tokens || undefined
    });

    return NextResponse.json({ 
      message: result.text,
      citations: result.citations,
      sessionId: result.sessionId,
      usage: result.usage,
      model: result.model
    });
  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    // Handle rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: 60 },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    );
  }
}