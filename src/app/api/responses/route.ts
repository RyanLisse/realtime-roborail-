import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { env } from '../../../lib/config/env';
import { responseRequestSchema, sanitizeJSON, validateContentLength } from '../../../lib/security/validation';

// Proxy endpoint for the OpenAI Responses API
export async function POST(req: NextRequest) {
  try {
    // Log security event
    const clientIP = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    console.log(`[Security] Response request from IP: ${clientIP}`);
    
    // Validate API key exists
    if (!env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }
    
    const body = await req.json();
    
    // Validate request body
    const validatedData = responseRequestSchema.parse(body);
    const sanitizedData = sanitizeJSON(validatedData);
    
    // Validate content length
    if (!validateContentLength(sanitizedData.text.value, 10000)) {
      return NextResponse.json(
        { error: "Content too long" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ 
      apiKey: env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    });

    if (sanitizedData.text?.format?.type === 'json_schema') {
      return await structuredResponse(openai, sanitizedData);
    } else {
      return await textResponse(openai, sanitizedData);
    }
  } catch (error) {
    console.error("Error in /responses:", error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

async function structuredResponse(openai: OpenAI, body: any) {
  try {
    const response = await openai.responses.parse({
      ...(body as any),
      stream: false,
    });

    // Sanitize response
    const sanitizedResponse = sanitizeJSON(response);
    return NextResponse.json(sanitizedResponse);
  } catch (err: any) {
    console.error('Structured response error:', err);
    
    // Handle specific OpenAI errors
    if (err.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: 60 },
        { status: 429 }
      );
    }
    
    if (err.status === 400) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function textResponse(openai: OpenAI, body: any) {
  try {
    const response = await openai.responses.create({
      ...(body as any),
      stream: false,
    });

    // Sanitize response
    const sanitizedResponse = sanitizeJSON(response);
    return NextResponse.json(sanitizedResponse);
  } catch (err: any) {
    console.error('Text response error:', err);
    
    // Handle specific OpenAI errors
    if (err.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: 60 },
        { status: 429 }
      );
    }
    
    if (err.status === 400) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
  