// Central re-exports so agent files don’t need to reach deep into the SDK path

export { tool } from '@openai/agents/realtime';
export type { RealtimeAgent, FunctionTool } from '@openai/agents/realtime';

// Enhanced agent configuration types
export interface AgentConfig {
  name: string;
  voice?: 'sage' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions: string;
  tools?: FunctionTool[];
  handoffs?: RealtimeAgent[];
  handoffDescription?: string;
  publicDescription?: string;
  toolLogic?: Record<string, Function>;
  downstreamAgents?: RealtimeAgent[];
  metadata?: AgentMetadata;
}

export interface AgentMetadata {
  category?: 'customer-service' | 'creative' | 'assistant' | 'specialized';
  complexity?: 'basic' | 'intermediate' | 'advanced';
  requiresAuthentication?: boolean;
  supportedLanguages?: string[];
  version?: string;
  description?: string;
}

export interface AgentScenario {
  name: string;
  description: string;
  agents: RealtimeAgent[];
  companyName?: string;
  defaultAgent?: string;
  metadata?: ScenarioMetadata;
}

export interface ScenarioMetadata {
  industry?: string;
  useCase?: string;
  complexity?: 'basic' | 'intermediate' | 'advanced';
  pattern?: 'chat-supervisor' | 'sequential-handoff' | 'multi-agent' | 'simple';
  tags?: string[];
}

export interface AgentHandoffConfig {
  sourceAgent: string;
  targetAgent: string;
  trigger?: string;
  conditions?: Record<string, any>;
  preserveContext?: boolean;
  transferMessage?: string;
}

export interface AgentStateManager {
  currentAgent?: string;
  previousAgent?: string;
  handoffHistory?: AgentHandoffConfig[];
  sharedContext?: Record<string, any>;
  sessionId?: string;
}

export interface SupervisorConfig {
  model?: 'gpt-4.1' | 'gpt-4o-mini' | 'gpt-4o';
  instructions: string;
  tools: any[];
  maxRetries?: number;
  timeoutMs?: number;
  parallelToolCalls?: boolean;
}

export interface ChatSupervisorPattern {
  chatAgent: RealtimeAgent;
  supervisorConfig: SupervisorConfig;
  routingLogic?: (message: string, context: any) => 'chat' | 'supervisor';
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  trigger: string;
  condition: (context: any) => boolean;
  action: 'escalate' | 'handoff' | 'redirect';
  target?: string;
  message?: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  implementation?: (input: any, details?: any) => Promise<any>;
}

export interface AgentContext {
  sessionId: string;
  userId?: string;
  conversationHistory: any[];
  currentAgent: string;
  sharedVariables: Record<string, any>;
  metadata: Record<string, any>;
  addTranscriptBreadcrumb?: (title: string, data?: any) => void;
}

export interface AgentPerformanceMetrics {
  agentName: string;
  totalSessions: number;
  averageSessionDuration: number;
  successfulHandoffs: number;
  failedHandoffs: number;
  userSatisfactionScore?: number;
  commonIssues: string[];
}

export interface AgentTestCase {
  name: string;
  description: string;
  scenario: string;
  input: string;
  expectedOutput?: string;
  expectedAgent?: string;
  expectedTools?: string[];
  assertions: TestAssertion[];
}

export interface TestAssertion {
  type: 'contains' | 'equals' | 'matches' | 'tool-called' | 'agent-handoff';
  value: any;
  description?: string;
}

export type AgentEventType = 
  | 'agent-start'
  | 'agent-end'
  | 'tool-call'
  | 'handoff-requested'
  | 'handoff-completed'
  | 'error'
  | 'escalation';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  agentName: string;
  data?: any;
  error?: string;
}

// Utility types for agent configuration validation
export type ValidateAgentConfig<T extends AgentConfig> = {
  [K in keyof T]: T[K] extends string 
    ? T[K] extends '' 
      ? never 
      : T[K]
    : T[K]
};

export type AgentConfigValidator = {
  validateName: (name: string) => boolean;
  validateInstructions: (instructions: string) => boolean;
  validateTools: (tools: FunctionTool[]) => boolean;
  validateHandoffs: (handoffs: RealtimeAgent[]) => boolean;
};

