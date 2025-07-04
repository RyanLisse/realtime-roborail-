import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../lib/config/env";
import { sessionRequestSchema, sanitizeJSON } from "../../../lib/security/validation";

export async function GET(request: NextRequest) {
  try {
    // Log security event
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    console.log(`[Security] Session request from IP: ${clientIP}`);
    
    // Validate API key exists
    if (!env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "OpenAI-Realtime-Agents/1.0.0",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: "External service error" },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Sanitize response data
    const sanitizedData = sanitizeJSON(data);
    
    return NextResponse.json(sanitizedData);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = sessionRequestSchema.parse(body);
    const sanitizedData = sanitizeJSON(validatedData);
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "OpenAI-Realtime-Agents/1.0.0",
        },
        body: JSON.stringify(sanitizedData),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: "External service error" },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    const sanitizedResponse = sanitizeJSON(data);
    
    return NextResponse.json(sanitizedResponse);
  } catch (error) {
    console.error("Error in /session POST:", error);
    
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
