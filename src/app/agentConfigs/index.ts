import { simpleHandoffScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';

// Enhanced system imports
import { integratedAgentSystem, enhancedAllAgentSets } from './integration';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Legacy compatibility - original scenarios
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

// Enhanced scenarios with full feature set
export const enhancedAgentSets: Record<string, any> = enhancedAllAgentSets;

// Convert enhanced scenarios to legacy format for compatibility
export const enhancedAgentSetsLegacy: Record<string, RealtimeAgent[]> = {};
for (const [key, scenario] of Object.entries(enhancedAllAgentSets)) {
  enhancedAgentSetsLegacy[key] = scenario.agents || [];
}

// Combined agent sets (legacy + enhanced)
export const combinedAgentSets: Record<string, RealtimeAgent[]> = {
  ...allAgentSets,
  ...enhancedAgentSetsLegacy
};

export const defaultAgentSetKey = 'chatSupervisor';
export const defaultEnhancedAgentSetKey = 'enhancedChatSupervisor';

// Export the integrated system for advanced usage
export { integratedAgentSystem };

// Export enhanced features
export * from './types';
export * from './utils';
export * from './handoff';
export * from './state/contextManager';
export * from './tests/agentBehaviorTests';

// Re-export enhanced components
export { EnhancedAuthenticationAgent } from './customerServiceRetail/enhanced/enhancedAuthentication';
export { EnhancedSalesAgent } from './customerServiceRetail/enhanced/enhancedSales';
export { enhancedChatSupervisorPattern } from './chatSupervisor/enhancedSupervisor';
