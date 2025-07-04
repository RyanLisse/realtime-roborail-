# OpenAI RAG Integration

This module provides comprehensive OpenAI RAG (Retrieval-Augmented Generation) integration with vector store search and citation system.

## Features

- **OpenAI Client**: Robust client with retry logic and error handling
- **RAG Service**: Vector store integration with file search capabilities
- **Citation System**: Parse and format citations from OpenAI responses
- **UI Components**: React components for displaying citations
- **Comprehensive Testing**: >95% test coverage with mocked OpenAI responses

## Quick Start

### 1. Environment Setup

Add required environment variables to `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
VECTOR_STORE_ID=your_vector_store_id_here
```

### 2. Vector Store Setup

Create and populate a vector store:

```bash
cd src/lib/openai
npx tsx setup.ts
```

This will:
- Create a new vector store in OpenAI
- Upload sample RoboRail documentation
- Output the `VECTOR_STORE_ID` for your `.env.local`

### 3. Basic Usage

```typescript
import { generateResponse } from './lib/openai';

// Generate response with citations
const result = await generateResponse({
  messages: [
    { role: 'user', content: 'What are the safety features of RoboRail?' }
  ],
});

console.log(result.text); // "RoboRail includes [1] collision avoidance..."
console.log(result.citations); // Array of citation objects
```

## API Reference

### Core Functions

#### `generateResponse(params)`

Main function for generating responses with RAG.

**Parameters:**
- `messages`: Array of chat messages
- `vectorStoreId?`: Optional custom vector store ID
- `enableCitations?`: Enable/disable citation extraction (default: true)

**Returns:**
```typescript
{
  text: string;           // Response text with citation markers
  citations: Citation[];  // Array of citation objects
  rawResponse: object;    // Raw OpenAI response
}
```

### RAGService

For advanced use cases, use the `RAGService` directly:

```typescript
import { RAGService } from './lib/openai';

const ragService = new RAGService({
  apiKey: process.env.OPENAI_API_KEY!,
  vectorStoreId: process.env.VECTOR_STORE_ID!,
  model: 'gpt-4o-mini',
  temperature: 0.7,
});

const result = await ragService.generateResponse({
  messages: [{ role: 'user', content: 'Question about RoboRail' }],
});
```

### Citation Types

```typescript
interface Citation {
  id: number;              // Sequential citation number
  fileId: string;          // OpenAI file ID
  quote: string;           // Relevant quote from document
  originalText: string;    // Original citation marker text
  filename?: string;       // Source filename (if available)
  pageNumber?: number;     // Page number (if available)
}
```

## UI Components

### CitationCard

Display individual citations:

```tsx
import { CitationCard } from './components/citations';

<CitationCard
  citation={citation}
  onClick={(citation) => console.log('Clicked:', citation)}
  showQuote={true}
/>
```

### CitationPanel

Display multiple citations with search and grouping:

```tsx
import { CitationPanel } from './components/citations';

<CitationPanel
  citations={citations}
  title="Sources"
  groupBySource={true}
  showSearch={true}
  onCitationClick={(citation) => handleCitationClick(citation)}
/>
```

## Integration Examples

### Chat API Integration

```typescript
// src/app/api/chat/route.ts
import { generateResponse } from '@/lib/openai';

export async function POST(request: Request) {
  const { messages } = await request.json();
  
  try {
    const result = await generateResponse({ messages });
    
    return Response.json({
      text: result.text,
      citations: result.citations,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
```

### React Hook Integration

```typescript
// Custom hook for RAG-powered chat
import { useState } from 'react';
import { generateResponse, Citation } from '@/lib/openai';

export function useRAGChat() {
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);

  const sendMessage = async (message: string) => {
    setLoading(true);
    try {
      const result = await generateResponse({
        messages: [{ role: 'user', content: message }],
      });
      
      setCitations(result.citations);
      return result.text;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, citations };
}
```

## Configuration

### Model Selection

The system supports different OpenAI models:

```typescript
const ragService = new RAGService({
  apiKey: process.env.OPENAI_API_KEY!,
  vectorStoreId: process.env.VECTOR_STORE_ID!,
  model: 'gpt-4o-mini',      // Fast, cost-effective
  // model: 'gpt-4o',        // Higher quality
  // model: 'gpt-4-turbo',   // Best quality
});
```

### Error Handling

The system includes comprehensive error handling:

```typescript
import { RAGError, OpenAIError, CitationError } from '@/lib/openai';

try {
  const result = await generateResponse({ messages });
} catch (error) {
  if (error instanceof RAGError) {
    console.error('RAG operation failed:', error.message);
  } else if (error instanceof OpenAIError) {
    console.error('OpenAI API error:', error.message);
  } else if (error instanceof CitationError) {
    console.error('Citation parsing error:', error.message);
  }
}
```

### Rate Limiting

The client includes automatic retry with exponential backoff:

```typescript
const client = new OpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Automatically retries on rate limits and transient errors
const response = await client.createResponse(messages);
```

## Testing

Run the comprehensive test suite:

```bash
# All OpenAI integration tests
npm test src/test/lib/openai

# Specific test files
npm test src/test/lib/openai/client.test.ts
npm test src/test/lib/openai/rag.test.ts
npm test src/test/lib/openai/citations.test.ts
```

### Test Coverage

- **OpenAI Client**: API calls, error handling, retry logic
- **RAG Service**: Response generation, search, configuration
- **Citation System**: Parsing, formatting, validation
- **UI Components**: Rendering, interactions, edge cases

## File Structure

```
src/lib/openai/
├── client.ts              # OpenAI client with retry logic
├── rag.ts                 # RAG service implementation
├── citations.ts           # Citation parsing and utilities
├── types.ts              # TypeScript type definitions
├── setup.ts              # Vector store setup utilities
├── index.ts              # Main exports
└── README.md             # This documentation

src/components/citations/
├── CitationCard.tsx       # Individual citation display
├── CitationPanel.tsx      # Citation sidebar/modal
└── index.ts              # Component exports

src/test/lib/openai/
├── client.test.ts         # Client tests
├── rag.test.ts           # RAG service tests
└── citations.test.ts     # Citation utility tests
```

## Best Practices

### 1. Vector Store Management

- Use descriptive names for vector stores
- Organize documents by topic or source
- Regularly update document embeddings
- Monitor vector store usage and costs

### 2. Citation Handling

- Always validate citation data before displaying
- Provide fallback displays for missing metadata
- Implement citation click handlers for better UX
- Group citations by source when helpful

### 3. Error Recovery

- Implement graceful fallbacks for API failures
- Show user-friendly error messages
- Log detailed errors for debugging
- Consider offline caching for critical responses

### 4. Performance Optimization

- Use appropriate model for use case (gpt-4o-mini for speed)
- Implement response caching where appropriate
- Batch similar requests when possible
- Monitor API usage and costs

## Troubleshooting

### Common Issues

1. **"Vector store not found"**
   - Verify `VECTOR_STORE_ID` in environment variables
   - Check vector store exists in OpenAI dashboard
   - Run setup script to create new vector store

2. **"API key invalid"**
   - Verify `OPENAI_API_KEY` is correct
   - Check API key has necessary permissions
   - Ensure key hasn't expired

3. **"No citations found"**
   - Verify documents are uploaded to vector store
   - Check if file search tool is enabled
   - Ensure vector store contains relevant content

4. **"Rate limit exceeded"**
   - Implement request queuing
   - Add delays between requests
   - Consider upgrading OpenAI plan

### Debug Mode

Enable debug logging:

```bash
DEBUG=openai:* npm run dev
```

## Contributing

When contributing to this module:

1. Maintain comprehensive test coverage (>95%)
2. Follow TypeScript strict mode requirements
3. Add JSDoc comments for public APIs
4. Update this README for new features
5. Run the full test suite before submitting PRs

## License

This module is part of the OpenAI Realtime Agents project and follows the same license terms.