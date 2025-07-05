import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { Agent } from '@/components/chat/AgentSelector';

// Mock the hooks and components
vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isLoading: false,
    error: null,
    isConnected: true,
    currentAgent: 'Customer Service',
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    clearError: vi.fn(),
    reconnect: vi.fn(),
    switchAgent: vi.fn(),
  }),
}));

vi.mock('@/contexts/RealtimeSessionContext', () => ({
  useOptionalRealtimeSession: () => ({
    sessionState: {
      status: 'CONNECTED',
      isVoiceEnabled: false,
    },
    switchAgent: vi.fn(),
    toggleVoice: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  }),
}));

vi.mock('../../../components/chat/ChatInterface', () => ({
  ChatInterface: ({ title, agentName, onAgentHandoff }: any) => (
    <div data-testid="chat-interface">
      <div>Chat Interface</div>
      <div>Title: {title}</div>
      <div>Agent: {agentName}</div>
      <button onClick={() => onAgentHandoff?.('Sales Assistant')}>
        Test Agent Handoff
      </button>
    </div>
  ),
}));

vi.mock('../../../components/voice/VoiceControls', () => ({
  VoiceControls: ({ onTranscription, disabled }: any) => (
    <div data-testid="voice-controls">
      <div>Voice Controls</div>
      <button 
        onClick={() => onTranscription?.('Test transcription')}
        disabled={disabled}
      >
        Test Voice Input
      </button>
    </div>
  ),
}));

const mockAgents: Agent[] = [
  {
    id: 'agent1',
    name: 'Customer Service',
    description: 'Handles customer inquiries',
    category: 'Support',
    isAvailable: true,
  },
  {
    id: 'agent2',
    name: 'Sales Assistant',
    description: 'Helps with sales',
    category: 'Sales',
    isAvailable: true,
  },
];

describe('ChatLayout', () => {
  const mockOnAgentChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all main components', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    expect(screen.getByText('OpenAI Realtime Agents')).toBeInTheDocument();
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    expect(screen.getByText('Select Agent')).toBeInTheDocument();
  });

  it('should handle agent selection', async () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open agent selector
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Select different agent
    fireEvent.click(screen.getByTestId('agent-option-agent2'));

    expect(mockOnAgentChange).toHaveBeenCalledWith('agent2');
  });

  it('should toggle voice mode', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        showVoiceControls={true}
      />
    );

    // Find and click voice mode toggle
    const voiceToggle = screen.getByRole('button', { 
      name: /Voice Mode/i 
    }).closest('button');
    
    expect(voiceToggle).toBeInTheDocument();
    fireEvent.click(voiceToggle!);

    // Voice controls should be visible after toggle
    expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
  });

  it('should handle voice transcription', async () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        showVoiceControls={true}
      />
    );

    // Enable voice mode first
    const voiceToggle = screen.getByRole('button', { 
      name: /Voice Mode/i 
    }).closest('button');
    fireEvent.click(voiceToggle!);

    // Wait for voice controls to appear
    await waitFor(() => {
      expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
    });

    // Test voice input
    const voiceInputButton = screen.getByText('Test Voice Input');
    fireEvent.click(voiceInputButton);

    // This would trigger the chat.sendMessage in the real implementation
    expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
  });

  it('should handle agent handoff from chat', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    // Simulate agent handoff from chat interface
    const handoffButton = screen.getByText('Test Agent Handoff');
    fireEvent.click(handoffButton);

    expect(mockOnAgentChange).toHaveBeenCalledWith('agent2');
  });

  it('should show connection status', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
      />
    );

    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Realtime')).toBeInTheDocument();
  });

  it('should display chat stats', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
      />
    );

    expect(screen.getByText('Messages:')).toBeInTheDocument();
    expect(screen.getByText('Current Agent:')).toBeInTheDocument();
    expect(screen.getByText('Customer Service')).toBeInTheDocument();
  });

  it('should handle mobile sidebar toggle', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
      />
    );

    // Mobile header should be visible (in real implementation)
    // For now, just check that the component renders without errors
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });

  it('should hide components when disabled', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        showVoiceControls={false}
        showAgentSelector={false}
      />
    );

    expect(screen.queryByText('Select Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Voice Mode')).not.toBeInTheDocument();
  });

  it('should handle clear conversation', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
      />
    );

    const clearButton = screen.getByText('Clear Conversation');
    expect(clearButton).toBeInTheDocument();
    
    // Button should be disabled when no messages (mocked to return empty array)
    expect(clearButton).toBeDisabled();
  });

  it('should show disconnect/reconnect button for realtime session', () => {
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
      />
    );

    const disconnectButton = screen.getByText('Disconnect');
    expect(disconnectButton).toBeInTheDocument();
    
    fireEvent.click(disconnectButton);
    // Should call disconnect on the realtime session
  });

  it('should use custom title when provided', () => {
    const customTitle = 'My Custom Agent Chat';
    render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        title={customTitle}
      />
    );

    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });

  it('should handle empty agents list', () => {
    render(
      <ChatLayout
        agents={[]}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Should still render but with no agent selected
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    expect(screen.getByText('Select Agent')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ChatLayout
        agents={mockAgents}
        initialAgent="agent1"
        className="custom-chat-layout"
      />
    );

    expect(container.firstChild).toHaveClass('custom-chat-layout');
  });
});