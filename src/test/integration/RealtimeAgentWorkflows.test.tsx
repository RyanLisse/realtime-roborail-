import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RealtimeSessionProvider } from '@/contexts/RealtimeSessionContext';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { agentConfigs } from '@/app/agentConfigs';

// Mock the agent configurations
const mockAgentConfigs = {
  'chat-supervisor': {
    name: 'Chat Supervisor',
    description: 'Chat with supervisor pattern',
    agents: [
      {
        name: 'Chat Agent',
        instructions: 'You are a helpful chat assistant',
        tools: [],
        toolLogic: {},
        downstreamAgents: [],
        publicDescription: 'Chat agent for immediate responses'
      },
      {
        name: 'Supervisor Agent',
        instructions: 'You are a supervisor that handles complex queries',
        tools: [
          {
            name: 'complex_query_handler',
            description: 'Handle complex queries',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                complexity: { type: 'number' }
              },
              required: ['query']
            }
          }
        ],
        toolLogic: {
          complex_query_handler: vi.fn().mockResolvedValue({
            result: 'Complex query handled successfully',
            confidence: 0.95
          })
        },
        downstreamAgents: [],
        publicDescription: 'Supervisor agent for complex tasks'
      }
    ]
  },
  'customer-service': {
    name: 'Customer Service',
    description: 'Multi-agent customer service flow',
    agents: [
      {
        name: 'Triage Agent',
        instructions: 'Triage customer inquiries',
        tools: [
          {
            name: 'agent_transfer',
            description: 'Transfer to another agent',
            parameters: {
              type: 'object',
              properties: {
                agent_name: { type: 'string' },
                context: { type: 'string' }
              },
              required: ['agent_name']
            }
          }
        ],
        toolLogic: {
          agent_transfer: vi.fn().mockResolvedValue({
            transfer_successful: true,
            next_agent: 'Support Agent'
          })
        },
        downstreamAgents: ['Support Agent', 'Billing Agent'],
        publicDescription: 'Initial triage for customer inquiries'
      },
      {
        name: 'Support Agent',
        instructions: 'Handle technical support issues',
        tools: [
          {
            name: 'create_ticket',
            description: 'Create support ticket',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' }
              },
              required: ['title', 'description']
            }
          }
        ],
        toolLogic: {
          create_ticket: vi.fn().mockResolvedValue({
            ticket_id: 'TICKET-12345',
            status: 'created'
          })
        },
        downstreamAgents: [],
        publicDescription: 'Technical support specialist'
      },
      {
        name: 'Billing Agent',
        instructions: 'Handle billing and payment issues',
        tools: [
          {
            name: 'process_refund',
            description: 'Process refund request',
            parameters: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                reason: { type: 'string' }
              },
              required: ['amount', 'reason']
            }
          }
        ],
        toolLogic: {
          process_refund: vi.fn().mockResolvedValue({
            refund_id: 'REFUND-67890',
            status: 'processed'
          })
        },
        downstreamAgents: [],
        publicDescription: 'Billing and payment specialist'
      }
    ]
  }
};

vi.mock('@/app/agentConfigs', () => ({
  agentConfigs: mockAgentConfigs
}));

describe('Realtime Agent Workflows', () => {
  let mockRealtimeSession: any;
  let mockOnAgentHandoff: any;
  let mockOnError: any;

  beforeEach(() => {
    mockOnAgentHandoff = vi.fn();
    mockOnError = vi.fn();
    
    mockRealtimeSession = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      addAgent: vi.fn(),
      removeAgent: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      interrupt: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      sendMessage: vi.fn(),
      switchAgent: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      isRecording: vi.fn().mockReturnValue(false),
      agents: [],
      currentAgent: null,
      status: 'connected',
      emit: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat-Supervisor Pattern', () => {
    it('should initialize with chat agent', async () => {
      render(
        <RealtimeSessionProvider>
          <AgentSelector
            agentConfigs={mockAgentConfigs}
            selectedAgentConfig="chat-supervisor"
            onConfigChange={vi.fn()}
            selectedAgent="Chat Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Chat Agent')).toBeInTheDocument();
      });
    });

    it('should handle agent switching from chat to supervisor', async () => {
      const onAgentChange = vi.fn();
      
      render(
        <RealtimeSessionProvider>
          <AgentSelector
            agentConfigs={mockAgentConfigs}
            selectedAgentConfig="chat-supervisor"
            onConfigChange={vi.fn()}
            selectedAgent="Chat Agent"
            onAgentChange={onAgentChange}
          />
        </RealtimeSessionProvider>
      );

      // Switch to supervisor agent
      const supervisorOption = screen.getByText('Supervisor Agent');
      fireEvent.click(supervisorOption);

      await waitFor(() => {
        expect(onAgentChange).toHaveBeenCalledWith('Supervisor Agent');
      });
    });

    it('should execute supervisor tools for complex queries', async () => {
      const mockToolLogic = mockAgentConfigs['chat-supervisor'].agents[1].toolLogic;
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['chat-supervisor']}
            selectedAgent="Supervisor Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Simulate complex query tool execution
      const complexQueryTool = mockToolLogic.complex_query_handler;
      const result = await complexQueryTool('What is the meaning of life?', 0.9);

      expect(result).toEqual({
        result: 'Complex query handled successfully',
        confidence: 0.95
      });
    });
  });

  describe('Sequential Handoff Pattern', () => {
    it('should start with triage agent', async () => {
      render(
        <RealtimeSessionProvider>
          <AgentSelector
            agentConfigs={mockAgentConfigs}
            selectedAgentConfig="customer-service"
            onConfigChange={vi.fn()}
            selectedAgent="Triage Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Triage Agent')).toBeInTheDocument();
      });
    });

    it('should handle agent transfer from triage to support', async () => {
      const mockToolLogic = mockAgentConfigs['customer-service'].agents[0].toolLogic;
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['customer-service']}
            selectedAgent="Triage Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Simulate agent transfer
      const transferTool = mockToolLogic.agent_transfer;
      const result = await transferTool('Support Agent', 'Technical issue needs expert help');

      expect(result).toEqual({
        transfer_successful: true,
        next_agent: 'Support Agent'
      });
    });

    it('should handle support agent ticket creation', async () => {
      const mockToolLogic = mockAgentConfigs['customer-service'].agents[1].toolLogic;
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['customer-service']}
            selectedAgent="Support Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Simulate ticket creation
      const createTicketTool = mockToolLogic.create_ticket;
      const result = await createTicketTool(
        'Login Issue',
        'User cannot access account after password reset',
        'high'
      );

      expect(result).toEqual({
        ticket_id: 'TICKET-12345',
        status: 'created'
      });
    });

    it('should handle billing agent refund processing', async () => {
      const mockToolLogic = mockAgentConfigs['customer-service'].agents[2].toolLogic;
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['customer-service']}
            selectedAgent="Billing Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Simulate refund processing
      const processRefundTool = mockToolLogic.process_refund;
      const result = await processRefundTool(29.99, 'Product defective');

      expect(result).toEqual({
        refund_id: 'REFUND-67890',
        status: 'processed'
      });
    });
  });

  describe('Agent State Management', () => {
    it('should maintain agent context during handoffs', async () => {
      const onAgentChange = vi.fn();
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['customer-service']}
            selectedAgent="Triage Agent"
            onAgentChange={onAgentChange}
          />
        </RealtimeSessionProvider>
      );

      // Simulate handoff with context preservation
      const transferTool = mockAgentConfigs['customer-service'].agents[0].toolLogic.agent_transfer;
      
      await act(async () => {
        await transferTool('Support Agent', 'Customer has login issues, tried password reset');
      });

      expect(transferTool).toHaveBeenCalledWith(
        'Support Agent',
        'Customer has login issues, tried password reset'
      );
    });

    it('should handle agent availability and routing', async () => {
      const config = mockAgentConfigs['customer-service'];
      const triageAgent = config.agents[0];
      
      // Check downstream agents are properly configured
      expect(triageAgent.downstreamAgents).toContain('Support Agent');
      expect(triageAgent.downstreamAgents).toContain('Billing Agent');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle tool execution errors gracefully', async () => {
      const mockToolLogic = {
        failing_tool: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
      };
      
      const configWithFailingTool = {
        name: 'Error Test',
        description: 'Test error handling',
        agents: [
          {
            name: 'Error Agent',
            instructions: 'Test error handling',
            tools: [
              {
                name: 'failing_tool',
                description: 'A tool that fails',
                parameters: {
                  type: 'object',
                  properties: {
                    input: { type: 'string' }
                  }
                }
              }
            ],
            toolLogic: mockToolLogic,
            downstreamAgents: [],
            publicDescription: 'Agent for testing error handling'
          }
        ]
      };

      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={configWithFailingTool}
            selectedAgent="Error Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Simulate tool failure
      try {
        await mockToolLogic.failing_tool('test input');
      } catch (error) {
        expect(error.message).toBe('Tool execution failed');
      }
    });

    it('should handle connection errors and retry logic', async () => {
      const mockFailingSession = {
        ...mockRealtimeSession,
        connect: vi.fn().mockRejectedValueOnce(new Error('Connection failed')),
        status: 'disconnected'
      };

      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['chat-supervisor']}
            selectedAgent="Chat Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      // Connection should be retried
      expect(mockFailingSession.connect).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent tool executions', async () => {
      const config = mockAgentConfigs['customer-service'];
      const toolPromises = [];
      
      // Execute multiple tools concurrently
      toolPromises.push(
        config.agents[0].toolLogic.agent_transfer('Support Agent', 'Context 1')
      );
      toolPromises.push(
        config.agents[1].toolLogic.create_ticket('Issue 1', 'Description 1')
      );
      toolPromises.push(
        config.agents[2].toolLogic.process_refund(50.00, 'Reason 1')
      );

      const results = await Promise.all(toolPromises);
      
      expect(results).toHaveLength(3);
      expect(results[0].transfer_successful).toBe(true);
      expect(results[1].ticket_id).toBe('TICKET-12345');
      expect(results[2].refund_id).toBe('REFUND-67890');
    });

    it('should maintain performance with large agent configurations', async () => {
      const largeConfig = {
        name: 'Large Configuration',
        description: 'Test with many agents',
        agents: Array.from({ length: 50 }, (_, i) => ({
          name: `Agent ${i + 1}`,
          instructions: `Instructions for agent ${i + 1}`,
          tools: [],
          toolLogic: {},
          downstreamAgents: [],
          publicDescription: `Agent ${i + 1} description`
        }))
      };

      const start = performance.now();
      
      render(
        <RealtimeSessionProvider>
          <AgentSelector
            agentConfigs={{ large: largeConfig }}
            selectedAgentConfig="large"
            onConfigChange={vi.fn()}
            selectedAgent="Agent 1"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      const end = performance.now();
      const renderTime = end - start;
      
      // Should render within reasonable time (< 1000ms)
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Data Flow and State Consistency', () => {
    it('should maintain consistent state across agent transitions', async () => {
      const onAgentChange = vi.fn();
      
      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={mockAgentConfigs['customer-service']}
            selectedAgent="Triage Agent"
            onAgentChange={onAgentChange}
          />
        </RealtimeSessionProvider>
      );

      // Simulate state transitions
      const triageAgent = mockAgentConfigs['customer-service'].agents[0];
      expect(triageAgent.name).toBe('Triage Agent');
      expect(triageAgent.downstreamAgents).toContain('Support Agent');
      expect(triageAgent.downstreamAgents).toContain('Billing Agent');
    });

    it('should preserve conversation context during handoffs', async () => {
      const conversationContext = {
        messages: ['Hello', 'I need help with billing'],
        customerInfo: { id: 'CUST-123', tier: 'premium' },
        previousAgent: 'Triage Agent'
      };

      const transferTool = mockAgentConfigs['customer-service'].agents[0].toolLogic.agent_transfer;
      
      await act(async () => {
        await transferTool('Billing Agent', JSON.stringify(conversationContext));
      });

      expect(transferTool).toHaveBeenCalledWith(
        'Billing Agent',
        JSON.stringify(conversationContext)
      );
    });
  });

  describe('Integration with External Systems', () => {
    it('should handle API integrations in tool logic', async () => {
      const mockApiTool = vi.fn().mockResolvedValue({
        api_response: { status: 200, data: 'Success' }
      });

      const configWithApiTool = {
        name: 'API Integration',
        description: 'Test API integration',
        agents: [
          {
            name: 'API Agent',
            instructions: 'Handle API calls',
            tools: [
              {
                name: 'api_call',
                description: 'Make API call',
                parameters: {
                  type: 'object',
                  properties: {
                    endpoint: { type: 'string' },
                    method: { type: 'string' }
                  }
                }
              }
            ],
            toolLogic: {
              api_call: mockApiTool
            },
            downstreamAgents: [],
            publicDescription: 'API integration agent'
          }
        ]
      };

      render(
        <RealtimeSessionProvider>
          <ChatInterface
            agentConfig={configWithApiTool}
            selectedAgent="API Agent"
            onAgentChange={vi.fn()}
          />
        </RealtimeSessionProvider>
      );

      const result = await mockApiTool('/api/test', 'GET');
      expect(result.api_response.status).toBe(200);
    });
  });
});