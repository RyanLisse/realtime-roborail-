import { RealtimeAgent } from '@openai/agents/realtime';
import { 
  AgentScenario, 
  ChatSupervisorPattern,
  AgentStateManager,
  AgentEventTracker,
  ScenarioMetadata
} from '../types';
import { createHandoffTools } from '../handoff';
import { enhancedChatSupervisorPattern } from '../chatSupervisor/enhancedSupervisor';
import { EnhancedAuthenticationAgent } from '../customerServiceRetail/enhanced/enhancedAuthentication';
import { EnhancedSalesAgent } from '../customerServiceRetail/enhanced/enhancedSales';
import { AdvancedContextManager, createStateSynchronizer } from '../state/contextManager';
import { AgentBehaviorTester, allTestCases } from '../tests/agentBehaviorTests';
import { defaultScenarioManager } from '../utils';

/**
 * Enhanced agent configuration system with full integration
 */
export class IntegratedAgentSystem {
  private scenarios: Map<string, AgentScenario> = new Map();
  private contextManager: AdvancedContextManager;
  private stateManager: AgentStateManager;
  private eventTracker: AgentEventTracker;
  private stateSynchronizer: any;
  private behaviorTester: AgentBehaviorTester;

  constructor() {
    this.contextManager = new AdvancedContextManager();
    this.stateManager = new AgentStateManager();
    this.eventTracker = new AgentEventTracker();
    this.stateSynchronizer = createStateSynchronizer(this.stateManager);
    this.behaviorTester = new AgentBehaviorTester();
    
    this.initializeScenarios();
  }

  /**
   * Initialize all agent scenarios
   */
  private initializeScenarios(): void {
    // Enhanced Chat-Supervisor scenario
    this.scenarios.set('enhancedChatSupervisor', this.createEnhancedChatSupervisorScenario());
    
    // Enhanced customer service retail scenario
    this.scenarios.set('enhancedCustomerServiceRetail', this.createEnhancedRetailScenario());
    
    // Simple handoff scenario (enhanced)
    this.scenarios.set('enhancedSimpleHandoff', this.createEnhancedSimpleHandoffScenario());
    
    // Test scenario for validation
    this.scenarios.set('testScenario', this.createTestScenario());
  }

  /**
   * Create enhanced chat-supervisor scenario
   */
  private createEnhancedChatSupervisorScenario(): AgentScenario {
    const chatAgent = new RealtimeAgent({
      name: 'enhancedChatAgent',
      voice: 'sage',
      instructions: enhancedChatSupervisorPattern.chatAgent?.instructions || `
You are an enhanced junior customer service agent with intelligent routing capabilities. 
You work alongside an advanced supervisor agent to provide exceptional customer service.

# Enhanced Capabilities
- Intelligent conversation routing
- Advanced context awareness
- Proactive escalation detection
- Real-time sentiment analysis
- Comprehensive handoff management

# Routing Intelligence
- Simple greetings and basic questions: Handle directly
- Complex queries or account issues: Route to supervisor
- Frustrated customers: Immediate escalation
- Multiple failed attempts: Smart escalation

Use your enhanced tools to provide seamless customer service while knowing when to escalate appropriately.
`,
      tools: [],
      handoffs: []
    });

    // Set up the enhanced pattern
    const enhancedPattern = { ...enhancedChatSupervisorPattern };
    enhancedPattern.chatAgent = chatAgent;

    const metadata: ScenarioMetadata = {
      industry: 'telecommunications',
      useCase: 'customer service with intelligent supervision',
      complexity: 'advanced',
      pattern: 'chat-supervisor',
      tags: ['intelligent routing', 'enhanced escalation', 'real-time analytics']
    };

    return {
      name: 'Enhanced Chat-Supervisor',
      description: 'Advanced chat-supervisor pattern with intelligent routing and enhanced capabilities',
      agents: [chatAgent],
      companyName: 'NewTelco',
      defaultAgent: 'enhancedChatAgent',
      metadata
    };
  }

  /**
   * Create enhanced retail scenario
   */
  private createEnhancedRetailScenario(): AgentScenario {
    const authAgent = new EnhancedAuthenticationAgent();
    const salesAgent = new EnhancedSalesAgent();
    
    // Create agent instances
    const availableAgents: RealtimeAgent[] = [];
    const authenticationAgent = authAgent.createAgent(availableAgents);
    const salesAgentInstance = salesAgent.createAgent(availableAgents);
    
    // Update available agents list
    availableAgents.push(authenticationAgent, salesAgentInstance);
    
    // Create handoff tools for each agent
    const { tools: authHandoffTools } = createHandoffTools(availableAgents);
    const { tools: salesHandoffTools } = createHandoffTools(availableAgents);
    
    // Add handoff tools to agents
    authenticationAgent.tools.push(...authHandoffTools);
    salesAgentInstance.tools.push(...salesHandoffTools);
    
    // Set up handoffs
    authenticationAgent.handoffs = [salesAgentInstance];
    salesAgentInstance.handoffs = [authenticationAgent];

    const metadata: ScenarioMetadata = {
      industry: 'retail',
      useCase: 'snowboard equipment sales and support',
      complexity: 'advanced',
      pattern: 'multi-agent',
      tags: ['personalization', 'advanced analytics', 'enhanced authentication']
    };

    return {
      name: 'Enhanced Customer Service Retail',
      description: 'Advanced retail scenario with enhanced authentication, personalized sales, and comprehensive analytics',
      agents: [authenticationAgent, salesAgentInstance],
      companyName: 'Snowy Peak Boards',
      defaultAgent: 'enhancedAuthentication',
      metadata
    };
  }

  /**
   * Create enhanced simple handoff scenario
   */
  private createEnhancedSimpleHandoffScenario(): AgentScenario {
    const availableAgents: RealtimeAgent[] = [];
    const { tools: handoffTools } = createHandoffTools(availableAgents);

    const greetingAgent = new RealtimeAgent({
      name: 'enhancedGreeter',
      voice: 'sage',
      instructions: `
You are an enhanced greeting agent with smart handoff capabilities.

Your job is to:
1. Provide a warm, professional greeting
2. Understand what the user needs
3. Use intelligent handoff tools to route them to the right specialist
4. Maintain context throughout the handoff process

Use your handoff tools to ensure smooth transitions and preserved context.
`,
      tools: handoffTools,
      handoffs: [],
      handoffDescription: 'Enhanced greeting agent with intelligent routing'
    });

    const poetryAgent = new RealtimeAgent({
      name: 'enhancedPoet',
      voice: 'sage',
      instructions: `
You are an enhanced poetry agent with context awareness.

Capabilities:
- Create beautiful haikus on any topic
- Remember user preferences from previous interactions
- Provide educational content about poetry forms
- Use context from handoffs to personalize poems

Always check shared context for user preferences and previous conversation history.
`,
      tools: handoffTools,
      handoffs: [],
      handoffDescription: 'Enhanced poetry agent with personalization'
    });

    availableAgents.push(greetingAgent, poetryAgent);
    greetingAgent.handoffs = [poetryAgent];
    poetryAgent.handoffs = [greetingAgent];

    const metadata: ScenarioMetadata = {
      industry: 'creative',
      useCase: 'interactive poetry creation with smart handoffs',
      complexity: 'intermediate',
      pattern: 'sequential-handoff',
      tags: ['creative writing', 'intelligent handoffs', 'context preservation']
    };

    return {
      name: 'Enhanced Simple Handoff',
      description: 'Simple handoff scenario enhanced with intelligent routing and context preservation',
      agents: [greetingAgent, poetryAgent],
      defaultAgent: 'enhancedGreeter',
      metadata
    };
  }

  /**
   * Create test scenario for validation
   */
  private createTestScenario(): AgentScenario {
    const testAgent = new RealtimeAgent({
      name: 'testAgent',
      voice: 'sage',
      instructions: 'Test agent for validating system functionality and running behavior tests.',
      tools: [],
      handoffs: [],
      handoffDescription: 'Test agent for system validation'
    });

    const metadata: ScenarioMetadata = {
      industry: 'testing',
      useCase: 'system validation and behavior testing',
      complexity: 'basic',
      pattern: 'simple',
      tags: ['testing', 'validation', 'quality assurance']
    };

    return {
      name: 'Test Scenario',
      description: 'Scenario for testing and validating agent behaviors',
      agents: [testAgent],
      defaultAgent: 'testAgent',
      metadata
    };
  }

  /**
   * Get scenario by key
   */
  getScenario(key: string): AgentScenario | undefined {
    return this.scenarios.get(key);
  }

  /**
   * Get all scenarios
   */
  getAllScenarios(): Map<string, AgentScenario> {
    return new Map(this.scenarios);
  }

  /**
   * Get scenarios by pattern
   */
  getScenariosByPattern(pattern: string): AgentScenario[] {
    return Array.from(this.scenarios.values()).filter(
      scenario => scenario.metadata?.pattern === pattern
    );
  }

  /**
   * Create session context for a scenario
   */
  createSessionContext(scenarioKey: string, sessionId: string, userId?: string): any {
    const scenario = this.getScenario(scenarioKey);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioKey}' not found`);
    }

    // Create context
    const context = this.contextManager.getContext(sessionId, userId);
    context.currentAgent = scenario.defaultAgent || scenario.agents[0].name;
    
    // Initialize state manager for this session
    const sessionState = new AgentStateManager(sessionId);
    sessionState.setCurrentAgent(context.currentAgent);
    
    // Set up synchronization
    this.stateSynchronizer.syncSharedContext(sessionId, 'scenario', scenarioKey, context.currentAgent);
    this.stateSynchronizer.syncSharedContext(sessionId, 'company', scenario.companyName, context.currentAgent);
    
    return {
      context,
      scenario,
      stateManager: sessionState,
      eventTracker: this.eventTracker
    };
  }

  /**
   * Handle agent handoff
   */
  async handleAgentHandoff(
    sessionId: string, 
    sourceAgent: string, 
    targetAgent: string, 
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const context = this.contextManager.getContext(sessionId);
      
      // Validate handoff
      if (!this.stateManager.canHandoffTo(targetAgent)) {
        return { success: false, error: 'Handoff would create circular loop' };
      }

      // Update context and state
      this.contextManager.setCurrentAgent(sessionId, targetAgent);
      this.stateSynchronizer.syncHandoff(sessionId, {
        sourceAgent,
        targetAgent,
        trigger: reason,
        preserveContext: true
      });

      // Record event
      this.eventTracker.addEvent('handoff-completed', targetAgent, {
        sourceAgent,
        reason,
        sessionId
      });

      return { success: true };
    } catch (error) {
      this.eventTracker.addEvent('error', sourceAgent, { 
        error: error.message, 
        operation: 'handoff',
        sessionId 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session analytics
   */
  getSessionAnalytics(sessionId: string): any {
    const contextAnalytics = this.contextManager.getAnalytics(sessionId);
    const events = this.eventTracker.getEvents();
    const sessionEvents = events.filter(e => e.data?.sessionId === sessionId);
    
    return {
      ...contextAnalytics,
      events: {
        total: sessionEvents.length,
        by_type: this.groupEventsByType(sessionEvents),
        recent: sessionEvents.slice(-10)
      }
    };
  }

  /**
   * Group events by type
   */
  private groupEventsByType(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Run behavior tests for a scenario
   */
  async runScenarioTests(scenarioKey: string): Promise<any> {
    const scenario = this.getScenario(scenarioKey);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioKey}' not found`);
    }

    // Filter test cases for this scenario
    const scenarioTestCases = allTestCases.filter(tc => 
      tc.scenario === scenarioKey || 
      tc.scenario === 'all' ||
      (scenarioKey.includes('retail') && tc.scenario === 'customerServiceRetail') ||
      (scenarioKey.includes('chatSupervisor') && tc.scenario === 'chatSupervisor')
    );

    if (scenarioTestCases.length === 0) {
      return {
        scenario: scenarioKey,
        message: 'No specific test cases found for this scenario',
        passed: 0,
        failed: 0,
        results: []
      };
    }

    const testResults = await this.behaviorTester.runTestSuite(scenarioTestCases);
    
    return {
      scenario: scenarioKey,
      ...testResults,
      report: this.behaviorTester.generateReport()
    };
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<any> {
    const results = await this.behaviorTester.runTestSuite(allTestCases);
    
    return {
      ...results,
      scenarios_tested: Array.from(this.scenarios.keys()),
      report: this.behaviorTester.generateReport(),
      global_stats: this.contextManager.getGlobalStats()
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): any {
    const globalStats = this.contextManager.getGlobalStats();
    const eventCounts = this.eventTracker.getEvents().reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const health = {
      status: 'healthy',
      scenarios: {
        total: this.scenarios.size,
        by_pattern: this.getScenarioPatternCounts()
      },
      performance: {
        ...globalStats,
        error_rate: this.calculateErrorRate(),
        average_session_duration: this.calculateAverageSessionDuration()
      },
      events: eventCounts,
      last_cleanup: this.contextManager.cleanupExpiredContexts(),
      timestamp: new Date().toISOString()
    };

    // Determine overall health status
    if (health.performance.error_rate > 0.1) {
      health.status = 'degraded';
    }
    if (health.performance.error_rate > 0.25) {
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Get scenario pattern counts
   */
  private getScenarioPatternCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const scenario of this.scenarios.values()) {
      const pattern = scenario.metadata?.pattern || 'unknown';
      counts[pattern] = (counts[pattern] || 0) + 1;
    }
    return counts;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const events = this.eventTracker.getEvents();
    const totalEvents = events.length;
    const errorEvents = events.filter(e => e.type === 'error').length;
    
    return totalEvents > 0 ? errorEvents / totalEvents : 0;
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(): number {
    // This would need to be implemented based on actual session data
    // For now, return a placeholder
    return 0;
  }

  /**
   * Export system configuration
   */
  exportConfiguration(): any {
    const scenarios: Record<string, any> = {};
    
    for (const [key, scenario] of this.scenarios.entries()) {
      scenarios[key] = {
        name: scenario.name,
        description: scenario.description,
        companyName: scenario.companyName,
        defaultAgent: scenario.defaultAgent,
        metadata: scenario.metadata,
        agents: scenario.agents.map(agent => ({
          name: agent.name,
          voice: agent.voice,
          handoffDescription: agent.handoffDescription,
          toolCount: agent.tools?.length || 0,
          handoffCount: agent.handoffs?.length || 0
        }))
      };
    }

    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      scenarios,
      systemHealth: this.getSystemHealth()
    };
  }

  /**
   * Reset system state
   */
  resetSystem(): void {
    this.contextManager = new AdvancedContextManager();
    this.stateManager = new AgentStateManager();
    this.eventTracker = new AgentEventTracker();
    this.stateSynchronizer = createStateSynchronizer(this.stateManager);
    this.behaviorTester = new AgentBehaviorTester();
  }
}

// Create and export the integrated system
export const integratedAgentSystem = new IntegratedAgentSystem();

// Export all scenarios for backward compatibility
export const enhancedAllAgentSets = Object.fromEntries(
  integratedAgentSystem.getAllScenarios().entries()
);

// Default export for easy importing
export default integratedAgentSystem;