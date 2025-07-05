import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSelector, Agent } from '@/components/chat/AgentSelector';

const mockAgents: Agent[] = [
  {
    id: 'agent1',
    name: 'Customer Service',
    description: 'Handles customer inquiries and support',
    category: 'Support',
    isAvailable: true,
  },
  {
    id: 'agent2',
    name: 'Sales Assistant',
    description: 'Helps with sales and product information',
    category: 'Sales',
    isAvailable: true,
  },
  {
    id: 'agent3',
    name: 'Technical Support',
    description: 'Provides technical assistance',
    category: 'Support',
    isAvailable: false,
  },
  {
    id: 'agent4',
    name: 'General Assistant',
    description: 'General purpose assistant',
    isAvailable: true,
  },
];

describe('AgentSelector', () => {
  const mockOnAgentChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with no agent selected initially', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    expect(screen.getByText('Select Agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-selector-button')).toBeInTheDocument();
  });

  it('should display current agent when selected', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        currentAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    expect(screen.getByText('Customer Service')).toBeInTheDocument();
    expect(screen.getByText('Handles customer inquiries and support')).toBeInTheDocument();
  });

  it('should open dropdown when clicked', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    const button = screen.getByTestId('agent-selector-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Should show all agents
    expect(screen.getByTestId('agent-option-agent1')).toBeInTheDocument();
    expect(screen.getByTestId('agent-option-agent2')).toBeInTheDocument();
    expect(screen.getByTestId('agent-option-agent3')).toBeInTheDocument();
    expect(screen.getByTestId('agent-option-agent4')).toBeInTheDocument();
  });

  it('should call onAgentChange when agent is selected', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Select an agent
    fireEvent.click(screen.getByTestId('agent-option-agent2'));

    expect(mockOnAgentChange).toHaveBeenCalledWith('agent2');
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.click(screen.getByTestId('agent-selector-overlay'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should filter agents based on search term', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Search for 'sales'
    const searchInput = screen.getByTestId('agent-search-input');
    fireEvent.change(searchInput, { target: { value: 'sales' } });

    await waitFor(() => {
      // Should only show Sales Assistant
      expect(screen.getByTestId('agent-option-agent2')).toBeInTheDocument();
      expect(screen.queryByTestId('agent-option-agent1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-option-agent3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-option-agent4')).not.toBeInTheDocument();
    });
  });

  it('should group agents by category', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Should show category headers
    expect(screen.getByText('SUPPORT')).toBeInTheDocument();
    expect(screen.getByText('SALES')).toBeInTheDocument();
    expect(screen.getByText('GENERAL')).toBeInTheDocument();
  });

  it('should disable unavailable agents', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const unavailableAgent = screen.getByTestId('agent-option-agent3');
    expect(unavailableAgent).toBeDisabled();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
        disabled={true}
      />
    );

    const button = screen.getByTestId('agent-selector-button');
    expect(button).toBeDisabled();
    
    // Should not open dropdown when disabled
    fireEvent.click(button);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should not show descriptions when showDescriptions is false', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        currentAgent="agent1"
        onAgentChange={mockOnAgentChange}
        showDescriptions={false}
      />
    );

    expect(screen.getByText('Customer Service')).toBeInTheDocument();
    expect(screen.queryByText('Handles customer inquiries and support')).not.toBeInTheDocument();
  });

  it('should show availability indicator', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        currentAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    // Should have green dot for available agent
    const availabilityIndicator = screen.getByTestId('agent-selector-button').querySelector('.bg-green-500');
    expect(availabilityIndicator).toBeInTheDocument();
  });

  it('should handle empty agent list', async () => {
    render(
      <AgentSelector
        agents={[]}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByText('No agents found')).toBeInTheDocument();
    });
  });

  it('should clear search when agent is selected', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Search for something
    const searchInput = screen.getByTestId('agent-search-input');
    fireEvent.change(searchInput, { target: { value: 'sales' } });

    // Select an agent
    fireEvent.click(screen.getByTestId('agent-option-agent2'));

    // Reopen dropdown - search should be cleared
    fireEvent.click(screen.getByTestId('agent-selector-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('agent-search-input')).toHaveValue('');
    });
  });

  it('should show current agent indicator in dropdown', async () => {
    render(
      <AgentSelector
        agents={mockAgents}
        currentAgent="agent1"
        onAgentChange={mockOnAgentChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('agent-selector-button'));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Should show "(current)" indicator
    expect(screen.getByText('(current)')).toBeInTheDocument();
  });
});