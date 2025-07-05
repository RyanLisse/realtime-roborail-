'use client';

import React, { useState, useCallback } from 'react';

export interface Agent {
  id: string;
  name: string;
  description: string;
  category?: string;
  isAvailable?: boolean;
}

export interface AgentSelectorProps {
  agents: Agent[];
  currentAgent?: string;
  onAgentChange: (agentId: string) => void;
  disabled?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

export const AgentSelector = ({
  agents,
  currentAgent,
  onAgentChange,
  disabled = false,
  showDescriptions = true,
  className = '',
}: AgentSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const selectAgent = useCallback((agentId: string) => {
    onAgentChange(agentId);
    setIsOpen(false);
    setSearchTerm('');
  }, [onAgentChange]);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentAgentData = agents.find(agent => agent.id === currentAgent);

  // Group agents by category if categories exist
  const groupedAgents = filteredAgents.reduce((groups, agent) => {
    const category = agent.category || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(agent);
    return groups;
  }, {} as Record<string, Agent[]>);

  return (
    <div className={`agent-selector relative ${className}`}>
      {/* Current Agent Display */}
      <button
        onClick={toggleOpen}
        disabled={disabled}
        data-testid="agent-selector-button"
        className={`
          w-full flex items-center justify-between p-3 border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          transition-colors duration-200
          ${disabled 
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
            : 'bg-white text-gray-800 hover:bg-gray-50 cursor-pointer'
          }
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select agent"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className={`w-3 h-3 rounded-full ${
            currentAgentData?.isAvailable !== false ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <div className="min-w-0 flex-1 text-left">
            <div className="font-medium truncate">
              {currentAgentData?.name || 'Select Agent'}
            </div>
            {showDescriptions && currentAgentData?.description && (
              <div className="text-sm text-gray-500 truncate">
                {currentAgentData.description}
              </div>
            )}
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Search Input */}
          {agents.length > 5 && (
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="agent-search-input"
              />
            </div>
          )}

          {/* Agent List */}
          <div className="max-h-60 overflow-y-auto" role="listbox">
            {Object.keys(groupedAgents).length === 0 ? (
              <div className="p-3 text-gray-500 text-center">
                No agents found
              </div>
            ) : (
              Object.entries(groupedAgents).map(([category, categoryAgents]) => (
                <div key={category}>
                  {Object.keys(groupedAgents).length > 1 && (
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      {category}
                    </div>
                  )}
                  {categoryAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => selectAgent(agent.id)}
                      data-testid={`agent-option-${agent.id}`}
                      className={`
                        w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50
                        focus:outline-none focus:bg-blue-50
                        ${currentAgent === agent.id ? 'bg-blue-50 text-blue-700' : 'text-gray-800'}
                        ${agent.isAvailable === false ? 'opacity-50' : ''}
                      `}
                      role="option"
                      aria-selected={currentAgent === agent.id}
                      disabled={agent.isAvailable === false}
                    >
                      <div className={`w-3 h-3 rounded-full ${
                        agent.isAvailable !== false ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {agent.name}
                          {currentAgent === agent.id && (
                            <span className="ml-2 text-blue-600 font-normal">(current)</span>
                          )}
                        </div>
                        {showDescriptions && agent.description && (
                          <div className="text-sm text-gray-500 truncate">
                            {agent.description}
                          </div>
                        )}
                      </div>
                      {agent.isAvailable === false && (
                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                          Unavailable
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          data-testid="agent-selector-overlay"
        />
      )}
    </div>
  );
};