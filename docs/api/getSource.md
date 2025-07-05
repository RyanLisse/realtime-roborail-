# GetSource API Endpoint

The `/api/getSource` endpoint retrieves source content from OpenAI files with optional context for citation functionality.

## Base URL
```
/api/getSource
```

## Authentication
All requests require a valid OpenAI API key in the Authorization header:
```
Authorization: Bearer YOUR_OPENAI_API_KEY
```

## Rate Limiting
- **Limit**: 30 requests per minute per client
- **Response**: `429 Too Many Requests` when exceeded

## GET Method

Retrieves source content for a specific file with optional context.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | Yes | OpenAI file ID to retrieve content from |
| `pageNumber` | number | No | Specific page number for PDF files |
| `startChar` | number | No | Start character position for content extraction |
| `endChar` | number | No | End character position for content extraction |
| `contextLines` | number | No | Number of context lines around content (0-20, default: 3) |

### Example Requests

#### Basic file retrieval
```bash
curl -X GET "https://api.example.com/api/getSource?fileId=file-abc123" \
  -H "Authorization: Bearer sk-..."
```

#### Page-specific content
```bash
curl -X GET "https://api.example.com/api/getSource?fileId=file-abc123&pageNumber=5&contextLines=2" \
  -H "Authorization: Bearer sk-..."
```

#### Character range extraction
```bash
curl -X GET "https://api.example.com/api/getSource?fileId=file-abc123&startChar=100&endChar=500&contextLines=5" \
  -H "Authorization: Bearer sk-..."
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "fileId": "file-abc123",
    "filename": "document.pdf",
    "content": "This is the main content that was requested.",
    "metadata": {
      "pageNumber": 5,
      "totalPages": 25,
      "mimeType": "application/pdf",
      "size": 2048576,
      "createdAt": "2023-01-15T10:30:00.000Z"
    },
    "context": {
      "before": "Content that appears before the requested section.",
      "after": "Content that appears after the requested section.",
      "startLine": 45,
      "endLine": 47
    }
  }
}
```

## POST Method

Supports both single file requests and batch operations.

### Single File Request

Same parameters as GET method but sent in request body:

```json
{
  "fileId": "file-abc123",
  "pageNumber": 5,
  "contextLines": 3
}
```

### Batch File Request

Retrieve multiple files in a single request:

```json
{
  "fileIds": ["file-abc123", "file-def456", "file-ghi789"]
}
```

#### Batch Response

```json
{
  "success": true,
  "sources": [
    {
      "fileId": "file-abc123",
      "filename": "document1.pdf",
      "content": "Content from first file...",
      "metadata": { "size": 1024, "createdAt": "2023-01-15T10:30:00.000Z" }
    },
    {
      "fileId": "file-def456", 
      "filename": "document2.pdf",
      "content": "Content from second file...",
      "metadata": { "size": 2048, "createdAt": "2023-01-16T14:22:00.000Z" }
    }
  ]
}
```

## Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "fileId",
        "message": "File ID is required"
      }
    ]
  }
}
```

### 401 Unauthorized - Missing/Invalid Auth
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization header"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key"
  }
}
```

### 403 Forbidden - Access Denied
```json
{
  "success": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Insufficient permissions to access file"
  }
}
```

### 404 Not Found - File Missing
```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found or access denied"
  }
}
```

### 429 Too Many Requests - Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve source content"
  }
}
```

## Data Models

### SourceContent
```typescript
interface SourceContent {
  fileId: string;           // OpenAI file identifier
  filename: string;         // Original filename
  content: string;          // Extracted text content
  metadata: {
    pageNumber?: number;    // Page number (for PDFs)
    totalPages?: number;    // Total pages in document
    mimeType?: string;      // File MIME type
    size?: number;          // File size in bytes
    createdAt?: string;     // File creation timestamp (ISO 8601)
  };
  context?: {
    before?: string;        // Content before requested section
    after?: string;         // Content after requested section
    startLine?: number;     // Starting line number
    endLine?: number;       // Ending line number
  };
  downloadUrl?: string;     // Optional direct download URL
}
```

### GetSourceResponse
```typescript
interface GetSourceResponse {
  success: boolean;
  data?: SourceContent;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Usage with Citation System

This endpoint is primarily used by the citation system to retrieve source content when users click on citation cards:

1. User clicks a citation card with `fileId`
2. Frontend calls `/api/getSource` with the file ID
3. Modal displays the retrieved content with context
4. User can download the full source file

### Citation Integration Example

```typescript
// Frontend usage in CitationSourceModal
const fetchSourceContent = async (citation: Citation) => {
  const params = new URLSearchParams({
    fileId: citation.fileId,
    ...(citation.pageNumber && { 
      pageNumber: citation.pageNumber.toString() 
    }),
    contextLines: '5'
  });

  const response = await fetch(`/api/getSource?${params}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  const result: GetSourceResponse = await response.json();
  
  if (result.success && result.data) {
    // Display content in modal
    setSourceContent(result.data);
  } else {
    // Handle error
    setError(result.error?.message || 'Failed to load source');
  }
};
```

## Security Considerations

1. **API Key Validation**: All requests must include a valid OpenAI API key
2. **Rate Limiting**: Prevents abuse with 30 requests/minute limit
3. **File Access Control**: Only files accessible by the provided API key can be retrieved
4. **Input Validation**: All parameters are validated using Zod schemas
5. **Error Handling**: Sensitive information is not exposed in error messages

## File Type Support

The endpoint supports various file types through OpenAI's files API:

- **PDF**: Extracts text content with page-based navigation
- **Text files**: Direct content retrieval
- **Word documents**: Converted text content
- **Markdown files**: Raw markdown content

## Performance Notes

- **Caching**: Consider implementing caching for frequently accessed files
- **Large Files**: Files over 10MB may have slower response times
- **Concurrent Requests**: Rate limiting applies per client, not per file
- **Memory Usage**: Large files are processed in streams to minimize memory usage

## Testing

The endpoint includes comprehensive test coverage:

- Unit tests for various request scenarios
- Integration tests with the citation system
- Error handling and edge case validation
- Security and authentication testing

See `/src/test/api/getSource.test.ts` for complete test examples.