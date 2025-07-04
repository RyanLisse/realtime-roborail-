import { tool } from '@openai/agents/realtime';
import { 
  AgentHandoffConfig, 
  AgentStateManager, 
  AgentEventTracker,
  AgentHandoffManager,
  AgentContext,
  RealtimeAgent
} from '../types';

/**
 * Core agent transfer tool that enables handoffs between agents
 */
export const createAgentTransferTool = (
  availableAgents: RealtimeAgent[],
  stateManager: AgentStateManager,
  eventTracker: AgentEventTracker
) => {
  const handoffManager = new AgentHandoffManager(stateManager, eventTracker);

  return tool({
    name: 'agent_transfer',
    description: 'Transfer the conversation to another specialized agent. Use this when the current agent cannot adequately handle the user\'s request.',
    parameters: {
      type: 'object',
      properties: {
        target_agent: {
          type: 'string',
          description: 'Name of the agent to transfer to',
          enum: availableAgents.map(agent => agent.name)
        },
        reason: {
          type: 'string',
          description: 'Brief explanation for why this transfer is needed'
        },
        context_summary: {
          type: 'string',
          description: 'Summary of conversation context to preserve for the target agent'
        },
        urgent: {
          type: 'boolean',
          description: 'Whether this transfer requires immediate attention',
          default: false
        }
      },
      required: ['target_agent', 'reason'],
      additionalProperties: false,
    },
    execute: async (input, details) => {
      const { target_agent, reason, context_summary, urgent = false } = input as {
        target_agent: string;
        reason: string;
        context_summary?: string;
        urgent?: boolean;
      };

      const currentAgent = stateManager.currentAgent || 'unknown';
      
      // Find target agent
      const targetAgent = availableAgents.find(agent => agent.name === target_agent);
      if (!targetAgent) {
        return {
          success: false,
          error: `Agent '${target_agent}' not found`
        };
      }

      // Attempt handoff
      const result = await handoffManager.requestHandoff(
        currentAgent,
        target_agent,
        reason,
        { context_summary, urgent },
        true // preserve context
      );

      if (result.success) {
        // Update shared context with handoff information
        stateManager.updateSharedContext('last_handoff', {
          from: currentAgent,
          to: target_agent,
          reason,
          timestamp: Date.now(),
          context_summary
        });

        return {
          success: true,
          message: `Transferring you to ${targetAgent.handoffDescription || target_agent}. ${context_summary ? 'They have been briefed on your situation.' : ''}`,
          new_agent: target_agent,
          handoff_context: context_summary
        };
      }

      return {
        success: false,
        error: result.error || 'Transfer failed'
      };
    }
  });
};

/**
 * Smart escalation tool that uses rules and context to determine best escalation path
 */
export const createSmartEscalationTool = (
  escalationPaths: { [key: string]: string },
  stateManager: AgentStateManager,
  eventTracker: AgentEventTracker
) => {
  return tool({
    name: 'smart_escalation',
    description: 'Escalate to appropriate specialist based on issue type and context. Analyzes conversation to determine best escalation path.',
    parameters: {
      type: 'object',
      properties: {
        issue_type: {
          type: 'string',
          enum: ['billing', 'technical', 'account', 'complaint', 'general'],
          description: 'Type of issue requiring escalation'
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Urgency level of the issue'
        },
        customer_sentiment: {
          type: 'string',
          enum: ['calm', 'frustrated', 'angry', 'urgent'],
          description: 'Current customer emotional state'
        },
        previous_attempts: {
          type: 'number',
          description: 'Number of previous resolution attempts',
          minimum: 0
        },
        issue_description: {
          type: 'string',
          description: 'Brief description of the issue for escalation context'
        }
      },
      required: ['issue_type', 'issue_description'],
      additionalProperties: false,
    },
    execute: async (input, details) => {
      const { 
        issue_type, 
        urgency = 'medium', 
        customer_sentiment = 'calm',
        previous_attempts = 0,
        issue_description
      } = input as {
        issue_type: string;
        urgency?: string;
        customer_sentiment?: string;
        previous_attempts?: number;
        issue_description: string;
      };

      // Determine escalation target based on issue type and context
      let escalationTarget = escalationPaths[issue_type] || escalationPaths['general'];
      
      // Adjust based on urgency and sentiment
      if (urgency === 'critical' || customer_sentiment === 'angry') {
        escalationTarget = escalationPaths['supervisor'] || escalationTarget;
      }

      if (previous_attempts > 2) {
        escalationTarget = escalationPaths['specialist'] || escalationTarget;
      }

      // Record escalation event
      eventTracker.addEvent('escalation', stateManager.currentAgent || 'unknown', {
        issue_type,
        urgency,
        customer_sentiment,
        previous_attempts,
        target: escalationTarget,
        issue_description
      });

      // Update context with escalation information
      stateManager.updateSharedContext('escalation_context', {
        issue_type,
        urgency,
        customer_sentiment,
        previous_attempts,
        issue_description,
        escalated_at: Date.now(),
        escalated_to: escalationTarget
      });

      // Generate appropriate escalation message
      let escalationMessage = `I understand this ${issue_type} issue needs specialized attention. `;
      
      if (customer_sentiment === 'frustrated' || customer_sentiment === 'angry') {
        escalationMessage += `I'm connecting you with a ${escalationTarget} who can provide immediate assistance. `;
      }
      
      if (previous_attempts > 1) {
        escalationMessage += `Given the complexity of this issue, they'll have the expertise to resolve it. `;
      }

      escalationMessage += `They'll have all the context from our conversation.`;

      return {
        success: true,
        escalation_target: escalationTarget,
        escalation_message: escalationMessage,
        issue_context: {
          type: issue_type,
          urgency,
          sentiment: customer_sentiment,
          attempts: previous_attempts,
          description: issue_description
        }
      };
    }
  });
};

/**
 * Context preservation tool for maintaining conversation state across handoffs
 */
export const createContextPreservationTool = (stateManager: AgentStateManager) => {
  return tool({
    name: 'preserve_context',
    description: 'Save important conversation context before handoff to ensure continuity',
    parameters: {
      type: 'object',
      properties: {
        key_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Important points from the conversation to preserve'
        },
        customer_info: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            account_id: { type: 'string' },
            phone: { type: 'string' },
            preferences: { type: 'object' }
          },
          description: 'Customer information to preserve'
        },
        issue_status: {
          type: 'string',
          enum: ['new', 'in_progress', 'escalated', 'resolved', 'pending'],
          description: 'Current status of the issue'
        },
        actions_taken: {
          type: 'array',
          items: { type: 'string' },
          description: 'Actions already taken to resolve the issue'
        },
        next_steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recommended next steps for the receiving agent'
        }
      },
      required: ['key_points'],
      additionalProperties: false,
    },
    execute: async (input, details) => {
      const { 
        key_points, 
        customer_info, 
        issue_status = 'in_progress',
        actions_taken = [],
        next_steps = []
      } = input as {
        key_points: string[];
        customer_info?: any;
        issue_status?: string;
        actions_taken?: string[];
        next_steps?: string[];
      };

      const contextData = {
        key_points,
        customer_info,
        issue_status,
        actions_taken,
        next_steps,
        preserved_at: Date.now(),
        preserving_agent: stateManager.currentAgent
      };

      // Store in shared context
      stateManager.updateSharedContext('preserved_context', contextData);

      // Also store in handoff history for reference
      const handoffHistory = stateManager.getHandoffHistory();
      if (handoffHistory.length > 0) {
        const lastHandoff = handoffHistory[handoffHistory.length - 1];
        stateManager.updateSharedContext(`handoff_context_${lastHandoff.targetAgent}`, contextData);
      }

      return {
        success: true,
        preserved_items: key_points.length,
        context_id: `ctx_${Date.now()}`,
        message: 'Context has been preserved for the next agent'
      };
    }
  });
};

/**
 * Handoff status tool for checking and managing handoff state
 */
export const createHandoffStatusTool = (stateManager: AgentStateManager) => {
  return tool({
    name: 'handoff_status',
    description: 'Check handoff history and current agent status',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['check_current', 'get_history', 'get_context', 'validate_target'],
          description: 'Type of handoff status check to perform'
        },
        target_agent: {
          type: 'string',
          description: 'Agent name to validate (for validate_target action)'
        }
      },
      required: ['action'],
      additionalProperties: false,
    },
    execute: async (input, details) => {
      const { action, target_agent } = input as {
        action: string;
        target_agent?: string;
      };

      switch (action) {
        case 'check_current':
          return {
            current_agent: stateManager.currentAgent,
            previous_agent: stateManager.previousAgent,
            session_id: stateManager.sessionId
          };

        case 'get_history':
          const history = stateManager.getHandoffHistory();
          return {
            handoff_count: history.length,
            history: history.slice(-5), // Last 5 handoffs
            most_recent: history[history.length - 1]
          };

        case 'get_context':
          return {
            shared_context: stateManager.sharedContext,
            preserved_context: stateManager.getSharedContext('preserved_context'),
            escalation_context: stateManager.getSharedContext('escalation_context')
          };

        case 'validate_target':
          if (!target_agent) {
            return { valid: false, error: 'Target agent name required' };
          }
          const canHandoff = stateManager.canHandoffTo(target_agent);
          return {
            valid: canHandoff,
            target_agent,
            reason: canHandoff ? 'Handoff allowed' : 'Would create circular handoff or too many recent handoffs'
          };

        default:
          return { error: 'Invalid action' };
      }
    }
  });
};

/**
 * Factory function to create all handoff tools for an agent configuration
 */
export const createHandoffTools = (
  availableAgents: RealtimeAgent[],
  escalationPaths: { [key: string]: string } = {},
  sessionId?: string
) => {
  const stateManager = new AgentStateManager(sessionId);
  const eventTracker = new AgentEventTracker();

  // Default escalation paths
  const defaultEscalationPaths = {
    billing: 'billing_specialist',
    technical: 'technical_support',
    account: 'account_specialist',
    complaint: 'supervisor',
    general: 'human_agent',
    supervisor: 'human_supervisor',
    specialist: 'expert_agent',
    ...escalationPaths
  };

  return {
    tools: [
      createAgentTransferTool(availableAgents, stateManager, eventTracker),
      createSmartEscalationTool(defaultEscalationPaths, stateManager, eventTracker),
      createContextPreservationTool(stateManager),
      createHandoffStatusTool(stateManager)
    ],
    stateManager,
    eventTracker
  };
};

// Export individual tool creators for custom configurations
export {
  createAgentTransferTool,
  createSmartEscalationTool,
  createContextPreservationTool,
  createHandoffStatusTool
};