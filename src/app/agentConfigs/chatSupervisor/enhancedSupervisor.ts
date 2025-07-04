import { RealtimeItem, tool } from '@openai/agents/realtime';
import { 
  ChatSupervisorPattern, 
  EscalationRule, 
  SupervisorConfig,
  AgentContext,
  ChatSupervisorManager,
  AgentEventTracker
} from '../types';
import { supervisorAgentTools } from './supervisorAgent';
import {
  exampleAccountInfo,
  examplePolicyDocs,
  exampleStoreLocations,
} from './sampleData';

/**
 * Enhanced supervisor configuration with intelligent routing
 */
export const enhancedSupervisorConfig: SupervisorConfig = {
  model: 'gpt-4.1',
  instructions: `You are an expert customer service supervisor agent with advanced routing intelligence. Your role is to provide high-quality responses and make intelligent decisions about when to escalate or redirect conversations.

# Core Responsibilities
1. Analyze conversation context and user intent
2. Provide accurate, helpful responses using available tools
3. Determine when escalation or handoff is needed
4. Maintain conversation flow and context

# Intelligent Routing Rules
- Simple greetings/chitchat: Handle directly
- Account-specific queries: Use tools first, then respond
- Policy questions: Always lookup documents before responding
- Complex technical issues: Escalate after initial assessment
- Billing disputes: Require human intervention after fact-gathering
- Multiple failed attempts: Escalate to human
- Frustrated customer indicators: Prioritize de-escalation

# Response Quality Standards
- Always cite sources when using retrieved information
- Provide specific numbers and details when available
- Maintain professional but empathetic tone
- Offer next steps or alternatives when appropriate
- Acknowledge limitations and escalate when necessary

# Context Awareness
- Track conversation sentiment and complexity
- Monitor tool success/failure rates
- Identify recurring issues or confusion
- Maintain awareness of customer effort level`,
  tools: supervisorAgentTools,
  maxRetries: 3,
  timeoutMs: 30000,
  parallelToolCalls: false
};

/**
 * Escalation rules for the enhanced supervisor
 */
export const enhancedEscalationRules: EscalationRule[] = [
  {
    trigger: 'billing_dispute',
    condition: (context: AgentContext) => {
      const messages = context.conversationHistory;
      const recentMessages = messages.slice(-3);
      const billingKeywords = ['refund', 'charge', 'overcharged', 'dispute', 'incorrect bill'];
      
      return recentMessages.some(msg => 
        billingKeywords.some(keyword => 
          msg.content?.toLowerCase().includes(keyword)
        )
      );
    },
    action: 'escalate',
    target: 'human_billing_specialist',
    message: 'Let me connect you with a billing specialist who can help resolve this issue.'
  },
  {
    trigger: 'technical_complexity',
    condition: (context: AgentContext) => {
      const failedTools = context.metadata.failedToolCalls || 0;
      const conversationLength = context.conversationHistory.length;
      
      return failedTools > 2 || (conversationLength > 10 && !context.metadata.issueResolved);
    },
    action: 'escalate',
    target: 'technical_support',
    message: 'This seems like a technical issue that would be better handled by our technical support team.'
  },
  {
    trigger: 'customer_frustration',
    condition: (context: AgentContext) => {
      const messages = context.conversationHistory;
      const recentMessages = messages.slice(-2);
      const frustrationKeywords = ['frustrated', 'angry', 'ridiculous', 'terrible', 'awful', 'horrible'];
      
      return recentMessages.some(msg => 
        frustrationKeywords.some(keyword => 
          msg.content?.toLowerCase().includes(keyword)
        )
      );
    },
    action: 'escalate',
    target: 'supervisor_human',
    message: 'I understand your frustration. Let me connect you with a supervisor who can help.'
  },
  {
    trigger: 'repeated_requests',
    condition: (context: AgentContext) => {
      const handoffCount = context.metadata.handoffCount || 0;
      return handoffCount > 2;
    },
    action: 'escalate',
    target: 'human_agent',
    message: 'Let me connect you with a human agent who can provide more personalized assistance.'
  }
];

/**
 * Intelligent routing logic for chat-supervisor pattern
 */
export const intelligentRoutingLogic = (message: string, context: AgentContext): 'chat' | 'supervisor' => {
  const messageText = message.toLowerCase();
  
  // Simple greetings and chitchat stay with chat agent
  const simplePatterns = [
    /^(hi|hello|hey|good morning|good afternoon)$/,
    /^(thank you|thanks|ok|okay|great)$/,
    /^(yes|no|sure|absolutely)$/
  ];
  
  if (simplePatterns.some(pattern => pattern.test(messageText))) {
    return 'chat';
  }
  
  // Complex queries go to supervisor
  const complexPatterns = [
    /billing|payment|charge|invoice/,
    /policy|procedure|rule|regulation/,
    /technical|error|broken|not working/,
    /escalate|supervisor|manager|human/,
    /account|profile|information|details/,
    /cancel|disconnect|terminate|close/
  ];
  
  if (complexPatterns.some(pattern => pattern.test(messageText))) {
    return 'supervisor';
  }
  
  // Check conversation context
  if (context.conversationHistory.length > 6) {
    return 'supervisor'; // Long conversations need supervisor oversight
  }
  
  if (context.metadata.failedAttempts && context.metadata.failedAttempts > 1) {
    return 'supervisor'; // Failed attempts need supervisor intervention
  }
  
  // Default to chat agent for simple interactions
  return 'chat';
};

/**
 * Enhanced tool response handler with better error handling and context tracking
 */
function getEnhancedToolResponse(fName: string, args: any, context?: AgentContext) {
  try {
    // Track tool usage
    if (context) {
      context.metadata.toolCalls = (context.metadata.toolCalls || 0) + 1;
      context.metadata.lastToolCall = fName;
    }

    switch (fName) {
      case "getUserAccountInfo":
        const phoneNumber = args.phone_number;
        if (!phoneNumber || phoneNumber === '' || phoneNumber === 'REQUIRED') {
          throw new Error('Phone number is required');
        }
        return exampleAccountInfo;
        
      case "lookupPolicyDocument":
        const topic = args.topic;
        if (!topic || topic === '' || topic === 'REQUIRED') {
          throw new Error('Topic is required');
        }
        return examplePolicyDocs;
        
      case "findNearestStore":
        const zipCode = args.zip_code;
        if (!zipCode || zipCode === '' || zipCode === 'REQUIRED') {
          throw new Error('Zip code is required');
        }
        return exampleStoreLocations;
        
      default:
        return { result: true };
    }
  } catch (error) {
    // Track failed tool calls
    if (context) {
      context.metadata.failedToolCalls = (context.metadata.failedToolCalls || 0) + 1;
      context.metadata.lastError = error.message;
    }
    throw error;
  }
}

/**
 * Enhanced supervisor response handler with context awareness
 */
async function handleEnhancedToolCalls(
  body: any,
  response: any,
  context?: AgentContext,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
  let currentResponse = response;
  let iterationCount = 0;
  const maxIterations = 5;

  while (iterationCount < maxIterations) {
    if (currentResponse?.error) {
      return { error: 'Something went wrong.' } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // Build final response
      const assistantMessages = outputItems.filter((item) => item.type === 'message');

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      // Track successful completion
      if (context) {
        context.metadata.issueResolved = true;
        context.metadata.completionTime = Date.now();
      }

      return finalText;
    }

    // Process function calls with enhanced error handling
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      
      try {
        const toolRes = getEnhancedToolResponse(fName, args, context);

        if (addBreadcrumb) {
          addBreadcrumb(`[enhancedSupervisor] function call: ${fName}`, args);
          addBreadcrumb(`[enhancedSupervisor] function call result: ${fName}`, toolRes);
        }

        // Add successful function call and result
        body.input.push(
          {
            type: 'function_call',
            call_id: toolCall.call_id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          {
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify(toolRes),
          },
        );
      } catch (error) {
        // Handle tool errors gracefully
        if (addBreadcrumb) {
          addBreadcrumb(`[enhancedSupervisor] tool error: ${fName}`, { error: error.message, args });
        }

        body.input.push(
          {
            type: 'function_call',
            call_id: toolCall.call_id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          {
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify({ error: error.message }),
          },
        );
      }
    }

    // Make follow-up request
    try {
      currentResponse = await fetchResponsesMessage(body);
    } catch (error) {
      if (context) {
        context.metadata.apiErrors = (context.metadata.apiErrors || 0) + 1;
      }
      return { error: 'API call failed' };
    }

    iterationCount++;
  }

  return { error: 'Maximum iterations exceeded' };
}

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Server returned an error:', response);
    throw new Error('API request failed');
  }

  return await response.json();
}

/**
 * Enhanced supervisor tool with intelligent routing and context awareness
 */
export const getEnhancedResponseFromSupervisor = tool({
  name: 'getEnhancedResponseFromSupervisor',
  description: 'Advanced supervisor agent that provides intelligent responses with context awareness and routing logic.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'Key information from the user\'s most recent message.',
      },
      conversationComplexity: {
        type: 'string',
        enum: ['simple', 'moderate', 'complex'],
        description: 'Assessment of conversation complexity level.',
      },
      userSentiment: {
        type: 'string',
        enum: ['positive', 'neutral', 'frustrated', 'angry'],
        description: 'Detected user sentiment.',
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { 
      relevantContextFromLastUserMessage, 
      conversationComplexity = 'moderate',
      userSentiment = 'neutral'
    } = input as {
      relevantContextFromLastUserMessage: string;
      conversationComplexity?: string;
      userSentiment?: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === 'message');

    // Create enhanced context
    const context: AgentContext = {
      sessionId: (details?.context as any)?.sessionId || 'unknown',
      conversationHistory: filteredLogs,
      currentAgent: 'enhancedSupervisor',
      sharedVariables: {},
      metadata: {
        complexity: conversationComplexity,
        sentiment: userSentiment,
        startTime: Date.now(),
        toolCalls: 0,
        failedToolCalls: 0
      },
      addTranscriptBreadcrumb: addBreadcrumb
    };

    // Check for escalation conditions
    const eventTracker = new AgentEventTracker();
    const supervisorManager = new ChatSupervisorManager({
      chatAgent: null as any, // Not needed for escalation check
      supervisorConfig: enhancedSupervisorConfig,
      escalationRules: enhancedEscalationRules
    }, eventTracker);

    const escalationResult = await supervisorManager.handleEscalation(
      relevantContextFromLastUserMessage,
      context,
      'enhancedSupervisor'
    );

    if (escalationResult.escalated) {
      return {
        nextResponse: escalationResult.action === 'escalate' 
          ? `I understand this requires specialized assistance. Let me connect you with ${escalationResult.target || 'a specialist'} who can better help you.`
          : 'Let me transfer you to someone who can better assist with this request.',
        escalationRequired: true,
        escalationTarget: escalationResult.target
      };
    }

    // Build enhanced prompt with context
    const body: any = {
      model: enhancedSupervisorConfig.model,
      input: [
        {
          type: 'message',
          role: 'system',
          content: `${enhancedSupervisorConfig.instructions}

# Current Context
- Conversation Complexity: ${conversationComplexity}
- User Sentiment: ${userSentiment}
- Message Count: ${filteredLogs.length}
- Session ID: ${context.sessionId}

# Instructions
Based on the context above, provide an appropriate response that matches the complexity level and user sentiment.`,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
          ${JSON.stringify(filteredLogs, null, 2)}
          
          ==== Current Request Context ===
          ${relevantContextFromLastUserMessage}
          
          Please provide a helpful response using available tools if needed.`,
        },
      ],
      tools: enhancedSupervisorConfig.tools,
    };

    try {
      const response = await fetchResponsesMessage(body);
      if (response.error) {
        return { error: 'Something went wrong.' };
      }

      const finalText = await handleEnhancedToolCalls(body, response, context, addBreadcrumb);
      if ((finalText as any)?.error) {
        return { error: 'Something went wrong.' };
      }

      return { 
        nextResponse: finalText as string,
        contextMetadata: context.metadata
      };
    } catch (error) {
      if (addBreadcrumb) {
        addBreadcrumb('[enhancedSupervisor] error', { error: error.message });
      }
      return { error: 'Something went wrong.' };
    }
  },
});

/**
 * Complete enhanced chat-supervisor pattern configuration
 */
export const enhancedChatSupervisorPattern: ChatSupervisorPattern = {
  chatAgent: null as any, // Will be set when integrating with chat agent
  supervisorConfig: enhancedSupervisorConfig,
  routingLogic: intelligentRoutingLogic,
  escalationRules: enhancedEscalationRules
};