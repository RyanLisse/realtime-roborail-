import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai } from '@/lib/openai/client';
import { rateLimit } from '@/lib/security/rateLimit';
import { validateAPIKey } from '@/lib/auth/config';

// Request validation schema
const getSourceSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  pageNumber: z.number().optional(),
  startChar: z.number().optional(),
  endChar: z.number().optional(),
  contextLines: z.number().min(0).max(20).default(3),
});

export type GetSourceRequest = z.infer<typeof getSourceSchema>;

export interface SourceContent {
  fileId: string;
  filename: string;
  content: string;
  metadata: {
    pageNumber?: number;
    totalPages?: number;
    mimeType?: string;
    size?: number;
    createdAt?: string;
  };
  context?: {
    before?: string;
    after?: string;
    startLine?: number;
    endLine?: number;
  };
  downloadUrl?: string;
}

export interface GetSourceResponse {
  success: boolean;
  data?: SourceContent;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * GET /api/getSource
 * 
 * Retrieves source content from OpenAI files with optional context
 * 
 * Query Parameters:
 * - fileId: OpenAI file ID (required)
 * - pageNumber: Specific page number (optional)
 * - startChar: Start character position (optional)
 * - endChar: End character position (optional)
 * - contextLines: Number of context lines around content (default: 3)
 * 
 * Returns source content with metadata and context
 */
export async function GET(request: NextRequest): Promise<NextResponse<GetSourceResponse>> {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      windowMs: 60 * 1000, // 30 requests per minute
    });
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    // API key validation
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const authResult = validateAPIKey(apiKey);
    
    if (!authResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
          },
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      fileId: url.searchParams.get('fileId'),
      pageNumber: url.searchParams.get('pageNumber') ? parseInt(url.searchParams.get('pageNumber')!) : undefined,
      startChar: url.searchParams.get('startChar') ? parseInt(url.searchParams.get('startChar')!) : undefined,
      endChar: url.searchParams.get('endChar') ? parseInt(url.searchParams.get('endChar')!) : undefined,
      contextLines: url.searchParams.get('contextLines') ? parseInt(url.searchParams.get('contextLines')!) : 3,
    };

    const validatedParams = getSourceSchema.parse(queryParams);

    // Retrieve file metadata from OpenAI
    const fileMetadata = await openai.files.retrieve(validatedParams.fileId);
    
    if (!fileMetadata) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    // Retrieve file content
    const fileContent = await openai.files.content(validatedParams.fileId);
    const contentText = await fileContent.text();

    // Process content based on parameters
    let processedContent = contentText;
    let context: SourceContent['context'] | undefined;

    // If specific character range is requested
    if (validatedParams.startChar !== undefined && validatedParams.endChar !== undefined) {
      const before = contentText.substring(
        Math.max(0, validatedParams.startChar - (validatedParams.contextLines * 100)),
        validatedParams.startChar
      );
      
      const after = contentText.substring(
        validatedParams.endChar,
        Math.min(contentText.length, validatedParams.endChar + (validatedParams.contextLines * 100))
      );

      processedContent = contentText.substring(validatedParams.startChar, validatedParams.endChar);
      
      context = {
        before: before.trim(),
        after: after.trim(),
      };
    }

    // If page number is specified (for PDFs)
    if (validatedParams.pageNumber !== undefined) {
      // For PDFs, we would need to process page-specific content
      // This is a simplified implementation - real PDF processing would require additional libraries
      const lines = contentText.split('\n');
      const estimatedLinesPerPage = 50; // Rough estimate
      const startLine = (validatedParams.pageNumber - 1) * estimatedLinesPerPage;
      const endLine = startLine + estimatedLinesPerPage;
      
      processedContent = lines.slice(startLine, endLine).join('\n');
      
      context = {
        startLine: startLine + 1,
        endLine: Math.min(endLine, lines.length),
        before: lines.slice(Math.max(0, startLine - validatedParams.contextLines), startLine).join('\n'),
        after: lines.slice(endLine, endLine + validatedParams.contextLines).join('\n'),
      };
    }

    // Construct response
    const sourceContent: SourceContent = {
      fileId: validatedParams.fileId,
      filename: fileMetadata.filename,
      content: processedContent,
      metadata: {
        pageNumber: validatedParams.pageNumber,
        mimeType: fileMetadata.object === 'file' ? 'text/plain' : undefined,
        size: fileMetadata.bytes,
        createdAt: new Date(fileMetadata.created_at * 1000).toISOString(),
      },
      context,
    };

    return NextResponse.json({
      success: true,
      data: sourceContent,
    });

  } catch (error) {
    console.error('Error retrieving source content:', error);

    // Handle specific OpenAI API errors
    if (error instanceof Error) {
      if (error.message.includes('No such file')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'File not found in OpenAI storage',
            },
          },
          { status: 404 }
        );
      }

      if (error.message.includes('permission')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ACCESS_DENIED',
              message: 'Insufficient permissions to access file',
            },
          },
          { status: 403 }
        );
      }
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve source content',
          details: process.env.NODE_ENV === 'development' ? error : undefined,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/getSource
 * 
 * Alternative method for complex source retrieval requests
 * Supports batch requests and advanced filtering
 */
export async function POST(request: NextRequest): Promise<NextResponse<GetSourceResponse | { sources: SourceContent[] }>> {
  try {
    const body = await request.json();
    
    // Handle batch requests
    if (Array.isArray(body.fileIds)) {
      const sources: SourceContent[] = [];
      
      for (const fileId of body.fileIds) {
        try {
          const fileMetadata = await openai.files.retrieve(fileId);
          const fileContent = await openai.files.content(fileId);
          const contentText = await fileContent.text();
          
          sources.push({
            fileId,
            filename: fileMetadata.filename,
            content: contentText,
            metadata: {
              mimeType: 'text/plain',
              size: fileMetadata.bytes,
              createdAt: new Date(fileMetadata.created_at * 1000).toISOString(),
            },
          });
        } catch (error) {
          console.warn(`Failed to retrieve file ${fileId}:`, error);
          // Continue with other files
        }
      }
      
      return NextResponse.json({
        success: true,
        sources,
      });
    }
    
    // Handle single file request (same as GET but with POST body)
    const validatedParams = getSourceSchema.parse(body);
    
    // Use the same logic as GET method
    const getResponse = await GET(request);
    return getResponse;

  } catch (error) {
    console.error('Error in POST getSource:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process source request',
        },
      },
      { status: 500 }
    );
  }
}