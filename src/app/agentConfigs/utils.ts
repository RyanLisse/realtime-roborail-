import { 
  AgentConfig, 
  AgentConfigValidator, 
  AgentScenario, 
  AgentHandoffConfig, 
  AgentStateManager, 
  ChatSupervisorPattern,
  EscalationRule,
  AgentEvent,
  AgentEventType,
  RealtimeAgent,
  FunctionTool
} from './types';

/**
 * Agent configuration validation utilities
 */
export class AgentValidator implements AgentConfigValidator {
  validateName(name: string): boolean {
    return name.length > 0 && name.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(name);
  }

  validateInstructions(instructions: string): boolean {
    return instructions.length > 10 && instructions.length <= 10000;
  }

  validateTools(tools: FunctionTool[]): boolean {
    if (!Array.isArray(tools)) return false;
    return tools.every(tool => 
      tool.name && 
      tool.description && 
      tool.parameters &&
      tool.parameters.type === 'object'
    );
  }

  validateHandoffs(handoffs: RealtimeAgent[]): boolean {
    if (!Array.isArray(handoffs)) return false;
    return handoffs.every(agent => agent.name && agent.instructions);
  }

  validateAgentConfig(config: AgentConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateName(config.name)) {
      errors.push('Invalid agent name: must be 1-50 characters, alphanumeric, underscore, or hyphen only');
    }

    if (!this.validateInstructions(config.instructions)) {
      errors.push('Invalid instructions: must be 10-10000 characters');
    }

    if (config.tools && !this.validateTools(config.tools)) {
      errors.push('Invalid tools configuration');
    }

    if (config.handoffs && !this.validateHandoffs(config.handoffs)) {
      errors.push('Invalid handoffs configuration');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Agent state management utilities
 */
export class AgentStateManager implements AgentStateManager {
  public currentAgent?: string;
  public previousAgent?: string;
  public handoffHistory: AgentHandoffConfig[] = [];
  public sharedContext: Record<string, any> = {};
  public sessionId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
  }

  setCurrentAgent(agentName: string): void {
    this.previousAgent = this.currentAgent;
    this.currentAgent = agentName;
  }

  addHandoff(handoffConfig: AgentHandoffConfig): void {
    this.handoffHistory.push({
      ...handoffConfig,
      timestamp: Date.now()
    } as AgentHandoffConfig & { timestamp: number });
  }

  updateSharedContext(key: string, value: any): void {
    this.sharedContext[key] = value;
  }

  getSharedContext(key: string): any {
    return this.sharedContext[key];
  }

  clearSharedContext(): void {
    this.sharedContext = {};
  }

  getHandoffHistory(): AgentHandoffConfig[] {
    return [...this.handoffHistory];
  }

  canHandoffTo(targetAgent: string): boolean {
    // Prevent immediate circular handoffs
    if (this.previousAgent === targetAgent) {
      return false;
    }

    // Check if agent has been in a handoff loop
    const recentHandoffs = this.handoffHistory.slice(-5);
    const targetHandoffs = recentHandoffs.filter(h => h.targetAgent === targetAgent);
    
    return targetHandoffs.length < 3;
  }
}

/**
 * Agent event tracking utilities
 */
export class AgentEventTracker {
  private events: AgentEvent[] = [];

  addEvent(type: AgentEventType, agentName: string, data?: any, error?: string): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      agentName,
      data,
      error
    });
  }

  getEvents(agentName?: string): AgentEvent[] {
    if (agentName) {
      return this.events.filter(e => e.agentName === agentName);
    }
    return [...this.events];
  }

  getEventsByType(type: AgentEventType): AgentEvent[] {
    return this.events.filter(e => e.type === type);
  }

  clearEvents(): void {
    this.events = [];
  }

  getLatestEvent(agentName?: string): AgentEvent | undefined {
    const events = agentName ? this.getEvents(agentName) : this.events;
    return events[events.length - 1];
  }
}

/**
 * Agent handoff utilities
 */
export class AgentHandoffManager {
  private stateManager: AgentStateManager;
  private eventTracker: AgentEventTracker;

  constructor(stateManager: AgentStateManager, eventTracker: AgentEventTracker) {
    this.stateManager = stateManager;
    this.eventTracker = eventTracker;
  }

  async requestHandoff(
    sourceAgent: string,
    targetAgent: string,
    trigger?: string,
    conditions?: Record<string, any>,
    preserveContext: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate handoff
      if (!this.stateManager.canHandoffTo(targetAgent)) {
        return { success: false, error: 'Handoff not allowed: would create circular loop' };
      }

      // Create handoff configuration
      const handoffConfig: AgentHandoffConfig = {
        sourceAgent,
        targetAgent,
        trigger,
        conditions,
        preserveContext
      };

      // Record handoff request
      this.eventTracker.addEvent('handoff-requested', sourceAgent, {
        targetAgent,
        trigger,
        conditions
      });

      // Execute handoff
      this.stateManager.addHandoff(handoffConfig);
      this.stateManager.setCurrentAgent(targetAgent);

      // Record successful handoff
      this.eventTracker.addEvent('handoff-completed', targetAgent, {
        sourceAgent,
        preserveContext
      });

      return { success: true };
    } catch (error) {
      this.eventTracker.addEvent('error', sourceAgent, { targetAgent }, error as string);
      return { success: false, error: error as string };
    }
  }

  getHandoffOptions(currentAgent: string, availableAgents: string[]): string[] {
    return availableAgents.filter(agent => 
      agent !== currentAgent && 
      this.stateManager.canHandoffTo(agent)
    );
  }
}

/**
 * Chat-Supervisor pattern utilities
 */
export class ChatSupervisorManager {
  private pattern: ChatSupervisorPattern;
  private eventTracker: AgentEventTracker;

  constructor(pattern: ChatSupervisorPattern, eventTracker: AgentEventTracker) {
    this.pattern = pattern;
    this.eventTracker = eventTracker;
  }

  shouldEscalateToSupervisor(message: string, context: any): boolean {
    // Check if custom routing logic exists
    if (this.pattern.routingLogic) {
      return this.pattern.routingLogic(message, context) === 'supervisor';
    }

    // Default escalation logic
    const escalationTriggers = [
      'supervisor', 'escalate', 'complex', 'help', 'manager',
      'billing', 'account', 'technical', 'policy', 'document'
    ];

    return escalationTriggers.some(trigger => 
      message.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  checkEscalationRules(context: any): EscalationRule | null {
    if (!this.pattern.escalationRules) return null;

    for (const rule of this.pattern.escalationRules) {
      if (rule.condition(context)) {
        return rule;
      }
    }

    return null;
  }

  async handleEscalation(
    message: string, 
    context: any, 
    agentName: string
  ): Promise<{ escalated: boolean; action?: string; target?: string }> {
    // Check escalation rules
    const escalationRule = this.checkEscalationRules(context);
    if (escalationRule) {
      this.eventTracker.addEvent('escalation', agentName, {
        rule: escalationRule,
        message
      });

      return {
        escalated: true,
        action: escalationRule.action,
        target: escalationRule.target
      };
    }

    // Check if should escalate to supervisor
    if (this.shouldEscalateToSupervisor(message, context)) {
      this.eventTracker.addEvent('escalation', agentName, {
        type: 'supervisor',
        message
      });

      return {
        escalated: true,
        action: 'escalate',
        target: 'supervisor'
      };
    }

    return { escalated: false };
  }
}

/**
 * Scenario configuration utilities
 */
export class ScenarioManager {
  private scenarios: Map<string, AgentScenario> = new Map();

  addScenario(key: string, scenario: AgentScenario): void {
    this.scenarios.set(key, scenario);
  }

  getScenario(key: string): AgentScenario | undefined {
    return this.scenarios.get(key);
  }

  getAllScenarios(): Map<string, AgentScenario> {
    return new Map(this.scenarios);
  }

  getScenariosByPattern(pattern: string): AgentScenario[] {
    return Array.from(this.scenarios.values()).filter(
      scenario => scenario.metadata?.pattern === pattern
    );
  }

  getScenariosByIndustry(industry: string): AgentScenario[] {
    return Array.from(this.scenarios.values()).filter(
      scenario => scenario.metadata?.industry === industry
    );
  }

  validateScenario(scenario: AgentScenario): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validator = new AgentValidator();

    if (!scenario.name || scenario.name.length === 0) {
      errors.push('Scenario name is required');
    }

    if (!scenario.description || scenario.description.length === 0) {
      errors.push('Scenario description is required');
    }

    if (!scenario.agents || scenario.agents.length === 0) {
      errors.push('Scenario must have at least one agent');
    }

    // Validate each agent configuration
    scenario.agents.forEach((agent, index) => {
      const agentConfig: AgentConfig = {
        name: agent.name,
        instructions: agent.instructions,
        tools: agent.tools,
        handoffs: agent.handoffs
      };

      const validation = validator.validateAgentConfig(agentConfig);
      if (!validation.isValid) {
        errors.push(`Agent ${index + 1} (${agent.name}): ${validation.errors.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Utility functions for agent configuration
 */
export const agentConfigUtils = {
  /**
   * Create a standardized agent configuration
   */
  createAgentConfig(
    name: string,
    instructions: string,
    options: Partial<AgentConfig> = {}
  ): AgentConfig {
    return {
      name,
      instructions,
      voice: options.voice || 'sage',
      tools: options.tools || [],
      handoffs: options.handoffs || [],
      handoffDescription: options.handoffDescription,
      publicDescription: options.publicDescription,
      toolLogic: options.toolLogic || {},
      downstreamAgents: options.downstreamAgents || [],
      metadata: options.metadata
    };
  },

  /**
   * Merge agent configurations
   */
  mergeAgentConfigs(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
    return {
      ...base,
      ...override,
      tools: override.tools ? [...(base.tools || []), ...override.tools] : base.tools,
      handoffs: override.handoffs ? [...(base.handoffs || []), ...override.handoffs] : base.handoffs,
      toolLogic: override.toolLogic ? { ...base.toolLogic, ...override.toolLogic } : base.toolLogic,
      metadata: override.metadata ? { ...base.metadata, ...override.metadata } : base.metadata
    };
  },

  /**
   * Extract agent names from a scenario
   */
  extractAgentNames(scenario: AgentScenario): string[] {
    return scenario.agents.map(agent => agent.name);
  },

  /**
   * Find agent by name in scenario
   */
  findAgentByName(scenario: AgentScenario, name: string): RealtimeAgent | undefined {
    return scenario.agents.find(agent => agent.name === name);
  },

  /**
   * Check if agent exists in scenario
   */
  hasAgent(scenario: AgentScenario, name: string): boolean {
    return scenario.agents.some(agent => agent.name === name);
  },

  /**
   * Get agent handoff targets
   */
  getHandoffTargets(agent: RealtimeAgent): string[] {
    return agent.handoffs?.map(handoff => handoff.name) || [];
  },

  /**
   * Check if handoff is valid
   */
  isValidHandoff(sourceAgent: RealtimeAgent, targetAgentName: string): boolean {
    const targets = this.getHandoffTargets(sourceAgent);
    return targets.includes(targetAgentName);
  }
};

// Export singleton instances for common use cases
export const defaultValidator = new AgentValidator();
export const defaultScenarioManager = new ScenarioManager();