// Core exports
export { OpenAIClient } from './client';
export { RAGService } from './rag';
export { CitationUtils } from './citations';

// Types
export type {
  OpenAIResponse,
  Citation,
  ParsedResponse,
  RAGConfig,
  GenerateResponseParams,
  GenerateResponseResult,
  OpenAIError,
  RAGError,
  CitationError,
} from './types';

// Configuration interfaces
export type { OpenAIClientConfig, CreateResponseOptions } from './client';
export type { RAGServiceConfig } from './rag';
export type { Annotation, FormattedCitation, SourceInfo } from './citations';

// In-memory session store (in production, use Redis or database)
const sessionStore = new Map<string, Array<{ role: string; content: string }>>();

// Main convenience function for generating responses with session management
export const generateResponse = async (params: GenerateResponseParams & { sessionId?: string }): Promise<GenerateResponseResult & { sessionId: string }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.VECTOR_STORE_ID;

  // Generate or use provided session ID
  const sessionId = params.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!apiKey) {
    console.warn('OPENAI_API_KEY not found, using mock responses');
    return generateMockResponse(params, sessionId);
  }

  if (!vectorStoreId) {
    console.warn('VECTOR_STORE_ID not found, using mock responses');
    return generateMockResponse(params, sessionId);
  }

  try {
    const ragService = new RAGService({
      apiKey,
      vectorStoreId,
    });

    // Get conversation history for session
    const conversationHistory = sessionStore.get(sessionId) || [];
    
    // Build full conversation context
    const systemPrompt = {
      role: 'system' as const,
      content: `You are RoboRail Assistant, an expert AI helping with HGG Profiling Equipment's RoboRail industrial machinery. 

Your role:
- Provide accurate information from the RoboRail documentation
- Help with maintenance procedures, safety protocols, and troubleshooting
- Always cite your sources with section references
- If information is not in the documentation, clearly state that
- Prioritize safety in all recommendations
- Keep responses concise but complete

When citing information, use the format: [Document Name - Section X.Y]

If you cannot find relevant information in the documentation, say "I don't have specific information about that in the RoboRail documentation. Please consult the technical support team or check the complete manual."`
    };

    const messages = [
      systemPrompt,
      ...conversationHistory,
      ...params.messages
    ];

    // Limit context window (keep last 20 messages)
    const limitedMessages = limitContextWindow(messages);

    const result = await ragService.generateResponse({
      ...params,
      messages: limitedMessages
    });

    // Store conversation in session
    const userMessage = params.messages[params.messages.length - 1];
    conversationHistory.push(userMessage);
    conversationHistory.push({ role: 'assistant', content: result.text });
    sessionStore.set(sessionId, conversationHistory);

    return {
      ...result,
      sessionId
    };
  } catch (error) {
    console.error('OpenAI RAG failed, falling back to mock response:', error);
    return generateMockResponse(params, sessionId);
  }
};

// Generate mock response for development/fallback
function generateMockResponse(params: GenerateResponseParams, sessionId: string): GenerateResponseResult & { sessionId: string } {
  const userMessage = params.messages[params.messages.length - 1]?.content || '';
  
  const mockResponses = {
    maintenance: "Based on the RoboRail maintenance documentation, the recommended daily maintenance routine includes: 1) Check hydraulic fluid levels 2) Inspect rail alignment 3) Test emergency stops 4) Clean sensor surfaces. Please refer to the Maintenance Manual Section 3.2 for detailed procedures. [Maintenance Manual - Section 3.2]",
    safety: "According to RoboRail safety protocols, all operators must complete safety certification before operation. Emergency stop procedures are outlined in Safety Manual Section 1.4. Always ensure proper PPE is worn during operation. [Safety Manual - Section 1.4]",
    troubleshooting: "For troubleshooting RoboRail equipment issues, first check the system status indicators. Common issues and solutions are documented in Technical Manual Section 5. If the problem persists, contact technical support. [Technical Manual - Section 5.1]",
    default: "I'm the RoboRail Assistant. I can help you with maintenance procedures, safety protocols, and troubleshooting. What specific information do you need about the RoboRail system?"
  };

  let responseText = mockResponses.default;
  if (userMessage.toLowerCase().includes('maintenance')) responseText = mockResponses.maintenance;
  if (userMessage.toLowerCase().includes('safety')) responseText = mockResponses.safety;
  if (userMessage.toLowerCase().includes('troubleshoot') || userMessage.toLowerCase().includes('error')) responseText = mockResponses.troubleshooting;

  return {
    text: responseText,
    citations: [{
      id: 'citation-1',
      text: 'RoboRail Technical Documentation',
      source: 'Technical Manual Section 3.2',
      confidence: 0.95,
      page: 45
    }],
    usage: { prompt_tokens: 150, completion_tokens: 75, total_tokens: 225 },
    model: 'gpt-4o-mock',
    sessionId
  };
}

// Limit conversation context to prevent token overflow
function limitContextWindow(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  // Always keep system prompt
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  // Keep last 20 messages (10 exchanges) plus system prompt
  const limitedMessages = otherMessages.slice(-20);
  
  return systemMessage ? [systemMessage, ...limitedMessages] : limitedMessages;
}