import { 
  AgentContext, 
  AgentStateManager, 
  AgentHandoffConfig,
  AgentEvent,
  AgentEventType 
} from '../types';

/**
 * Advanced context manager for agent conversations
 */
export class AdvancedContextManager {
  private contexts: Map<string, AgentContext> = new Map();
  private globalState: Map<string, any> = new Map();
  private contextHistory: Map<string, AgentContext[]> = new Map();
  private maxHistoryLength = 50;
  private contextExpiryTime = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create or get context for a session
   */
  getContext(sessionId: string, userId?: string): AgentContext {
    let context = this.contexts.get(sessionId);
    
    if (!context) {
      context = this.createNewContext(sessionId, userId);
      this.contexts.set(sessionId, context);
    }
    
    // Update last activity
    context.metadata.lastActivity = Date.now();
    return context;
  }

  /**
   * Create a new context
   */
  private createNewContext(sessionId: string, userId?: string): AgentContext {
    return {
      sessionId,
      userId,
      conversationHistory: [],
      currentAgent: '',
      sharedVariables: {},
      metadata: {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        conversationCount: 0,
        handoffCount: 0,
        toolCallCount: 0,
        errorCount: 0,
        version: '1.0'
      }
    };
  }

  /**
   * Update context with new information
   */
  updateContext(sessionId: string, updates: Partial<AgentContext>): void {
    const context = this.getContext(sessionId);
    
    // Merge updates into existing context
    Object.assign(context, updates);
    
    // Update metadata
    context.metadata.lastActivity = Date.now();
    if (updates.conversationHistory) {
      context.metadata.conversationCount = updates.conversationHistory.length;
    }
    
    // Save to history
    this.saveContextToHistory(sessionId, context);
  }

  /**
   * Add message to conversation history
   */
  addMessage(sessionId: string, message: any): void {
    const context = this.getContext(sessionId);
    context.conversationHistory.push(message);
    context.metadata.conversationCount = context.conversationHistory.length;
    context.metadata.lastActivity = Date.now();
  }

  /**
   * Update shared variables
   */
  setSharedVariable(sessionId: string, key: string, value: any): void {
    const context = this.getContext(sessionId);
    context.sharedVariables[key] = {
      value,
      timestamp: Date.now(),
      type: typeof value
    };
    context.metadata.lastActivity = Date.now();
  }

  /**
   * Get shared variable
   */
  getSharedVariable(sessionId: string, key: string): any {
    const context = this.getContext(sessionId);
    const variable = context.sharedVariables[key];
    return variable ? variable.value : undefined;
  }

  /**
   * Set current agent
   */
  setCurrentAgent(sessionId: string, agentName: string): void {
    const context = this.getContext(sessionId);
    const previousAgent = context.currentAgent;
    
    context.currentAgent = agentName;
    context.metadata.lastActivity = Date.now();
    
    // Track handoff if agent changed
    if (previousAgent && previousAgent !== agentName) {
      context.metadata.handoffCount = (context.metadata.handoffCount || 0) + 1;
      
      // Store handoff information
      this.setSharedVariable(sessionId, `handoff_${Date.now()}`, {
        from: previousAgent,
        to: agentName,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record tool call
   */
  recordToolCall(sessionId: string, toolName: string, success: boolean, duration?: number): void {
    const context = this.getContext(sessionId);
    context.metadata.toolCallCount = (context.metadata.toolCallCount || 0) + 1;
    
    if (!success) {
      context.metadata.errorCount = (context.metadata.errorCount || 0) + 1;
    }
    
    // Store tool call details
    const toolCalls = context.sharedVariables.toolCalls?.value || [];
    toolCalls.push({
      toolName,
      success,
      duration,
      timestamp: Date.now()
    });
    
    this.setSharedVariable(sessionId, 'toolCalls', toolCalls);
  }

  /**
   * Get conversation analytics
   */
  getAnalytics(sessionId: string): any {
    const context = this.getContext(sessionId);
    const sessionDuration = Date.now() - (context.metadata.createdAt || 0);
    
    // Analyze conversation patterns
    const toolCalls = context.sharedVariables.toolCalls?.value || [];
    const successfulTools = toolCalls.filter((t: any) => t.success).length;
    const failedTools = toolCalls.filter((t: any) => !t.success).length;
    
    // Calculate engagement metrics
    const averageResponseTime = this.calculateAverageResponseTime(context);
    const conversationComplexity = this.assessConversationComplexity(context);
    
    return {
      session: {
        id: sessionId,
        duration_ms: sessionDuration,
        duration_formatted: this.formatDuration(sessionDuration),
        message_count: context.metadata.conversationCount || 0,
        handoff_count: context.metadata.handoffCount || 0,
        current_agent: context.currentAgent
      },
      tools: {
        total_calls: context.metadata.toolCallCount || 0,
        successful_calls: successfulTools,
        failed_calls: failedTools,
        success_rate: toolCalls.length > 0 ? (successfulTools / toolCalls.length) * 100 : 0
      },
      engagement: {
        average_response_time_ms: averageResponseTime,
        complexity_score: conversationComplexity,
        user_satisfaction_indicators: this.detectSatisfactionIndicators(context)
      },
      context: {
        shared_variables_count: Object.keys(context.sharedVariables).length,
        last_activity: new Date(context.metadata.lastActivity || 0).toISOString(),
        context_size_kb: this.calculateContextSize(context)
      }
    };
  }

  /**
   * Save context to history
   */
  private saveContextToHistory(sessionId: string, context: AgentContext): void {
    const history = this.contextHistory.get(sessionId) || [];
    
    // Create a deep copy for history
    const contextCopy = JSON.parse(JSON.stringify(context));
    history.push(contextCopy);
    
    // Limit history size
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
    
    this.contextHistory.set(sessionId, history);
  }

  /**
   * Get context history
   */
  getContextHistory(sessionId: string): AgentContext[] {
    return this.contextHistory.get(sessionId) || [];
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(context: AgentContext): number {
    const messages = context.conversationHistory;
    if (messages.length < 2) return 0;
    
    let totalTime = 0;
    let responseCount = 0;
    
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      
      if (prev.timestamp && curr.timestamp) {
        totalTime += curr.timestamp - prev.timestamp;
        responseCount++;
      }
    }
    
    return responseCount > 0 ? totalTime / responseCount : 0;
  }

  /**
   * Assess conversation complexity
   */
  private assessConversationComplexity(context: AgentContext): number {
    let complexity = 0;
    
    // Factor in conversation length
    complexity += Math.min(context.metadata.conversationCount || 0, 20) * 0.5;
    
    // Factor in handoffs
    complexity += (context.metadata.handoffCount || 0) * 2;
    
    // Factor in tool calls
    complexity += (context.metadata.toolCallCount || 0) * 1.5;
    
    // Factor in errors
    complexity += (context.metadata.errorCount || 0) * 3;
    
    // Normalize to 0-100 scale
    return Math.min(complexity, 100);
  }

  /**
   * Detect user satisfaction indicators
   */
  private detectSatisfactionIndicators(context: AgentContext): any {
    const messages = context.conversationHistory;
    const indicators = {
      positive_keywords: 0,
      negative_keywords: 0,
      questions_resolved: 0,
      escalations_requested: 0
    };
    
    const positiveWords = ['thank', 'great', 'perfect', 'excellent', 'good', 'helpful'];
    const negativeWords = ['frustrated', 'angry', 'terrible', 'awful', 'bad', 'horrible'];
    
    messages.forEach((message: any) => {
      if (message.content && typeof message.content === 'string') {
        const content = message.content.toLowerCase();
        
        positiveWords.forEach(word => {
          if (content.includes(word)) indicators.positive_keywords++;
        });
        
        negativeWords.forEach(word => {
          if (content.includes(word)) indicators.negative_keywords++;
        });
        
        if (content.includes('escalate') || content.includes('supervisor')) {
          indicators.escalations_requested++;
        }
      }
    });
    
    return indicators;
  }

  /**
   * Calculate context size in KB
   */
  private calculateContextSize(context: AgentContext): number {
    const contextString = JSON.stringify(context);
    return Math.round((contextString.length * 2) / 1024); // Rough estimate in KB
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Clean up expired contexts
   */
  cleanupExpiredContexts(): number {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [sessionId, context] of this.contexts.entries()) {
      const lastActivity = context.metadata.lastActivity || 0;
      if (now - lastActivity > this.contextExpiryTime) {
        this.contexts.delete(sessionId);
        this.contextHistory.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Export context for backup or analysis
   */
  exportContext(sessionId: string): any {
    const context = this.getContext(sessionId);
    const history = this.getContextHistory(sessionId);
    const analytics = this.getAnalytics(sessionId);
    
    return {
      context,
      history,
      analytics,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import context from backup
   */
  importContext(sessionId: string, data: any): void {
    if (data.context) {
      this.contexts.set(sessionId, data.context);
    }
    
    if (data.history) {
      this.contextHistory.set(sessionId, data.history);
    }
  }

  /**
   * Merge contexts from different sessions
   */
  mergeContexts(primarySessionId: string, secondarySessionId: string): void {
    const primaryContext = this.getContext(primarySessionId);
    const secondaryContext = this.contexts.get(secondarySessionId);
    
    if (!secondaryContext) return;
    
    // Merge conversation histories
    primaryContext.conversationHistory.push(...secondaryContext.conversationHistory);
    
    // Merge shared variables (primary takes precedence)
    Object.keys(secondaryContext.sharedVariables).forEach(key => {
      if (!primaryContext.sharedVariables[key]) {
        primaryContext.sharedVariables[key] = secondaryContext.sharedVariables[key];
      }
    });
    
    // Update metadata
    primaryContext.metadata.conversationCount = primaryContext.conversationHistory.length;
    primaryContext.metadata.handoffCount = 
      (primaryContext.metadata.handoffCount || 0) + 
      (secondaryContext.metadata.handoffCount || 0);
    
    // Clean up secondary context
    this.contexts.delete(secondarySessionId);
    this.contextHistory.delete(secondarySessionId);
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): any {
    const totalContexts = this.contexts.size;
    const totalHistoryEntries = Array.from(this.contextHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    let totalMessages = 0;
    let totalHandoffs = 0;
    let totalToolCalls = 0;
    
    for (const context of this.contexts.values()) {
      totalMessages += context.metadata.conversationCount || 0;
      totalHandoffs += context.metadata.handoffCount || 0;
      totalToolCalls += context.metadata.toolCallCount || 0;
    }
    
    return {
      active_contexts: totalContexts,
      total_history_entries: totalHistoryEntries,
      total_messages: totalMessages,
      total_handoffs: totalHandoffs,
      total_tool_calls: totalToolCalls,
      average_messages_per_context: totalContexts > 0 ? totalMessages / totalContexts : 0,
      memory_usage_estimate_mb: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const context of this.contexts.values()) {
      totalSize += this.calculateContextSize(context);
    }
    
    for (const history of this.contextHistory.values()) {
      totalSize += history.reduce((sum, ctx) => sum + this.calculateContextSize(ctx), 0);
    }
    
    return Math.round(totalSize / 1024); // Convert to MB
  }
}

/**
 * Cross-agent state synchronization
 */
export class CrossAgentStateSynchronizer {
  private stateManager: AgentStateManager;
  private contextManager: AdvancedContextManager;
  private subscriptions: Map<string, Set<Function>> = new Map();

  constructor(stateManager: AgentStateManager, contextManager: AdvancedContextManager) {
    this.stateManager = stateManager;
    this.contextManager = contextManager;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(event: string, callback: Function): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    
    this.subscriptions.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.get(event)?.delete(callback);
    };
  }

  /**
   * Emit state change event
   */
  private emit(event: string, data: any): void {
    const callbacks = this.subscriptions.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in state change callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Synchronize agent handoff
   */
  syncHandoff(sessionId: string, handoffConfig: AgentHandoffConfig): void {
    // Update state manager
    this.stateManager.addHandoff(handoffConfig);
    this.stateManager.setCurrentAgent(handoffConfig.targetAgent);
    
    // Update context manager
    this.contextManager.setCurrentAgent(sessionId, handoffConfig.targetAgent);
    
    // Store handoff context
    if (handoffConfig.preserveContext) {
      this.contextManager.setSharedVariable(sessionId, 'last_handoff_context', {
        sourceAgent: handoffConfig.sourceAgent,
        targetAgent: handoffConfig.targetAgent,
        trigger: handoffConfig.trigger,
        conditions: handoffConfig.conditions,
        timestamp: Date.now()
      });
    }
    
    // Emit handoff event
    this.emit('agent_handoff', {
      sessionId,
      handoffConfig,
      timestamp: Date.now()
    });
  }

  /**
   * Synchronize shared context
   */
  syncSharedContext(sessionId: string, key: string, value: any, agentName: string): void {
    // Update both managers
    this.stateManager.updateSharedContext(key, value);
    this.contextManager.setSharedVariable(sessionId, key, value);
    
    // Emit context update event
    this.emit('context_update', {
      sessionId,
      agentName,
      key,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get synchronized state
   */
  getSynchronizedState(sessionId: string): any {
    const context = this.contextManager.getContext(sessionId);
    const stateHistory = this.stateManager.getHandoffHistory();
    
    return {
      context,
      currentAgent: this.stateManager.currentAgent,
      previousAgent: this.stateManager.previousAgent,
      handoffHistory: stateHistory,
      sharedContext: this.stateManager.sharedContext,
      lastActivity: context.metadata.lastActivity
    };
  }

  /**
   * Reset synchronized state
   */
  resetState(sessionId: string): void {
    // Clear state manager
    this.stateManager.clearSharedContext();
    this.stateManager.handoffHistory = [];
    
    // Create new context
    const newContext = this.contextManager.getContext(sessionId);
    newContext.conversationHistory = [];
    newContext.sharedVariables = {};
    newContext.currentAgent = '';
    
    // Emit reset event
    this.emit('state_reset', {
      sessionId,
      timestamp: Date.now()
    });
  }
}

// Export singleton instances
export const globalContextManager = new AdvancedContextManager();
export const createStateSynchronizer = (stateManager: AgentStateManager) => {
  return new CrossAgentStateSynchronizer(stateManager, globalContextManager);
};