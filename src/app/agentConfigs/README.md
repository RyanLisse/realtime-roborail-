# Enhanced Agent Configuration System

This directory contains a comprehensive and enhanced agent configuration system for the OpenAI Realtime API. The system provides advanced agent management, intelligent handoffs, state management, and comprehensive testing capabilities.

## 🚀 Key Features

### 1. Enhanced TypeScript Types
- Comprehensive type definitions for all agent configurations
- Strong typing for agent metadata, scenarios, and state management
- Validation utilities with detailed error reporting
- Type-safe agent configuration builders

### 2. Chat-Supervisor Pattern with Intelligent Routing
- Advanced chat-supervisor pattern implementation
- Intelligent message routing based on complexity and context
- Real-time escalation rules and conditions
- Enhanced supervisor with context awareness and analytics

### 3. Agent Handoff Tools and Mechanisms
- Smart agent transfer with context preservation
- Intelligent escalation based on conversation analysis
- Context sharing across agent transitions
- Handoff validation and circular loop prevention

### 4. Enhanced Customer Service Agents
- **Enhanced Authentication Agent**: Advanced validation, state management, and error handling
- **Enhanced Sales Agent**: Personalization, advanced product filtering, and analytics
- **Enhanced Returns Agent**: (Ready for implementation with same pattern)

### 5. Comprehensive Test Coverage
- Behavior testing framework for agent interactions
- Test cases for all agent types and scenarios
- Validation testing for configurations
- Performance and stress testing capabilities

### 6. State Management and Context Sharing
- Advanced context manager with session tracking
- Cross-agent state synchronization
- Analytics and conversation insights
- Context preservation across handoffs

## 📁 Directory Structure

```
src/app/agentConfigs/
├── types.ts                           # Enhanced TypeScript types
├── utils.ts                          # Utility functions and validators
├── index.ts                          # Main exports and integration
├── README.md                         # This file
│
├── chatSupervisor/
│   ├── index.ts                      # Original chat-supervisor
│   ├── supervisorAgent.ts            # Original supervisor logic
│   ├── enhancedSupervisor.ts         # Enhanced supervisor with routing
│   └── sampleData.ts                 # Sample data for tools
│
├── customerServiceRetail/
│   ├── index.ts                      # Original retail scenario
│   ├── authentication.ts             # Original authentication agent
│   ├── sales.ts                      # Original sales agent
│   ├── returns.ts                    # Original returns agent
│   ├── simulatedHuman.ts             # Original human agent simulation
│   └── enhanced/
│       ├── enhancedAuthentication.ts # Enhanced authentication with state management
│       └── enhancedSales.ts          # Enhanced sales with personalization
│
├── handoff/
│   └── index.ts                      # Agent handoff tools and mechanisms
│
├── state/
│   └── contextManager.ts             # Context management and state synchronization
│
├── tests/
│   └── agentBehaviorTests.ts         # Comprehensive test framework
│
└── integration/
    └── index.ts                      # Integrated system with all enhancements
```

## 🛠 Usage

### Basic Usage (Legacy Compatibility)

```typescript
import { allAgentSets, defaultAgentSetKey } from '@/app/agentConfigs';

// Get original scenarios
const chatSupervisorAgents = allAgentSets['chatSupervisor'];
const retailAgents = allAgentSets['customerServiceRetail'];
```

### Enhanced Usage

```typescript
import { 
  integratedAgentSystem, 
  enhancedAgentSets,
  EnhancedAuthenticationAgent,
  EnhancedSalesAgent 
} from '@/app/agentConfigs';

// Get enhanced scenarios
const enhancedRetail = integratedAgentSystem.getScenario('enhancedCustomerServiceRetail');
const enhancedChatSupervisor = integratedAgentSystem.getScenario('enhancedChatSupervisor');

// Create session context
const sessionContext = integratedAgentSystem.createSessionContext(
  'enhancedCustomerServiceRetail',
  'session_123',
  'user_456'
);

// Handle agent handoffs
await integratedAgentSystem.handleAgentHandoff(
  'session_123',
  'enhancedAuthentication',
  'enhancedSalesAgent',
  'User wants to browse products'
);

// Get analytics
const analytics = integratedAgentSystem.getSessionAnalytics('session_123');
```

### Custom Agent Creation

```typescript
import { 
  EnhancedAuthenticationAgent,
  EnhancedSalesAgent,
  createHandoffTools,
  AgentStateManager 
} from '@/app/agentConfigs';

// Create enhanced agents
const authAgent = new EnhancedAuthenticationAgent();
const salesAgent = new EnhancedSalesAgent();

// Create agent instances with handoff tools
const availableAgents = [];
const authenticationAgent = authAgent.createAgent(availableAgents);
const salesAgentInstance = salesAgent.createAgent(availableAgents);

// Set up handoffs
authenticationAgent.handoffs = [salesAgentInstance];
salesAgentInstance.handoffs = [authenticationAgent];
```

## 🧪 Testing

### Running Tests

```typescript
import { integratedAgentSystem } from '@/app/agentConfigs';

// Run tests for specific scenario
const retailTests = await integratedAgentSystem.runScenarioTests('enhancedCustomerServiceRetail');

// Run all tests
const allTests = await integratedAgentSystem.runAllTests();

// Get test report
console.log(allTests.report);
```

### Creating Custom Tests

```typescript
import { AgentTestCase, AgentBehaviorTester } from '@/app/agentConfigs';

const customTestCase: AgentTestCase = {
  name: 'custom_test',
  description: 'Test custom agent behavior',
  scenario: 'myScenario',
  input: 'Hello, I need help',
  expectedAgent: 'myAgent',
  expectedTools: ['myTool'],
  assertions: [
    {
      type: 'contains',
      value: 'help',
      description: 'Response should offer help'
    }
  ]
};

const tester = new AgentBehaviorTester();
const result = await tester.runTestCase(customTestCase);
```

## 📊 Analytics and Monitoring

### Session Analytics

```typescript
// Get detailed session analytics
const analytics = integratedAgentSystem.getSessionAnalytics('session_123');

console.log(analytics);
// Output:
// {
//   session: {
//     id: 'session_123',
//     duration_ms: 450000,
//     duration_formatted: '7m 30s',
//     message_count: 15,
//     handoff_count: 2,
//     current_agent: 'enhancedSalesAgent'
//   },
//   tools: {
//     total_calls: 8,
//     successful_calls: 7,
//     failed_calls: 1,
//     success_rate: 87.5
//   },
//   engagement: {
//     average_response_time_ms: 2500,
//     complexity_score: 45,
//     user_satisfaction_indicators: { ... }
//   },
//   context: {
//     shared_variables_count: 12,
//     last_activity: '2024-01-15T10:30:00.000Z',
//     context_size_kb: 15.2
//   }
// }
```

### System Health

```typescript
// Get overall system health
const health = integratedAgentSystem.getSystemHealth();

console.log(health);
// Output:
// {
//   status: 'healthy',
//   scenarios: {
//     total: 4,
//     by_pattern: {
//       'chat-supervisor': 1,
//       'multi-agent': 1,
//       'sequential-handoff': 1,
//       'simple': 1
//     }
//   },
//   performance: {
//     active_contexts: 23,
//     total_messages: 456,
//     error_rate: 0.02,
//     average_session_duration: 8.5
//   }
// }
```

## 🔧 Configuration

### Agent Metadata

All enhanced agents include comprehensive metadata:

```typescript
interface AgentMetadata {
  category: 'customer-service' | 'creative' | 'assistant' | 'specialized';
  complexity: 'basic' | 'intermediate' | 'advanced';
  requiresAuthentication: boolean;
  supportedLanguages: string[];
  version: string;
  description: string;
}
```

### Scenario Configuration

Enhanced scenarios provide rich metadata and capabilities:

```typescript
interface AgentScenario {
  name: string;
  description: string;
  agents: RealtimeAgent[];
  companyName?: string;
  defaultAgent?: string;
  metadata?: ScenarioMetadata;
}
```

## 🚀 Advanced Features

### 1. Intelligent Routing
- Context-aware message routing
- Sentiment analysis for escalation
- Complexity assessment for supervisor routing
- Real-time decision making

### 2. State Management
- Cross-agent context sharing
- Session state persistence
- Handoff history tracking
- Analytics collection

### 3. Enhanced Error Handling
- Graceful degradation
- Retry mechanisms
- Error recovery strategies
- Comprehensive logging

### 4. Performance Optimization
- Context cleanup and memory management
- Efficient state synchronization
- Optimized tool execution
- Analytics-driven improvements

## 📈 Metrics and KPIs

The system tracks comprehensive metrics:

- **Conversation Metrics**: Message count, duration, complexity
- **Handoff Metrics**: Success rate, circular loops, context preservation
- **Tool Metrics**: Call count, success rate, performance
- **User Experience**: Response time, satisfaction indicators, resolution rate
- **System Health**: Error rate, memory usage, active sessions

## 🔄 Migration Guide

### From Original to Enhanced

1. **Import Changes**:
   ```typescript
   // Old
   import { allAgentSets } from '@/app/agentConfigs';
   
   // New (backward compatible)
   import { allAgentSets, integratedAgentSystem } from '@/app/agentConfigs';
   ```

2. **Enhanced Features**:
   ```typescript
   // Access enhanced scenarios
   const enhanced = integratedAgentSystem.getScenario('enhancedCustomerServiceRetail');
   
   // Use advanced analytics
   const analytics = integratedAgentSystem.getSessionAnalytics(sessionId);
   
   // Run comprehensive tests
   const testResults = await integratedAgentSystem.runAllTests();
   ```

3. **State Management**:
   ```typescript
   // Create session with full context management
   const session = integratedAgentSystem.createSessionContext(scenario, sessionId);
   
   // Handle handoffs with context preservation
   await integratedAgentSystem.handleAgentHandoff(sessionId, source, target, reason);
   ```

## 🎯 Best Practices

1. **Always use the integrated system** for new implementations
2. **Test agent behaviors** regularly using the testing framework
3. **Monitor session analytics** to optimize user experience
4. **Implement proper error handling** for production resilience
5. **Use state management** for complex multi-agent scenarios
6. **Regular health checks** to ensure system performance

## 🤝 Contributing

When adding new agents or features:

1. Follow the established TypeScript patterns
2. Include comprehensive test cases
3. Add proper metadata and documentation
4. Implement state management if needed
5. Update this README with new features

## 📚 API Reference

For detailed API documentation, refer to the TypeScript definitions in `types.ts` and the implementation examples in the integration tests.

---

This enhanced agent configuration system provides a robust foundation for building sophisticated conversational AI experiences with the OpenAI Realtime API.