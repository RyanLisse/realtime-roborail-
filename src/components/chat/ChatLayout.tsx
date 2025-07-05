'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChatInterface } from './ChatInterface';
import { AgentSelector, Agent } from './AgentSelector';
import { VoiceControls } from '../voice/VoiceControls';
import { useChat } from '@/hooks/useChat';
import { useOptionalRealtimeSession } from '@/contexts/RealtimeSessionContext';

export interface ChatLayoutProps {
  agents: Agent[];
  initialAgent?: string;
  title?: string;
  showVoiceControls?: boolean;
  showAgentSelector?: boolean;
  onAgentChange?: (agentId: string) => void;
  className?: string;
}

export const ChatLayout = ({
  agents,
  initialAgent,
  title = 'OpenAI Realtime Agents',
  showVoiceControls = true,
  showAgentSelector = true,
  onAgentChange,
  className = '',
}: ChatLayoutProps) => {
  const [currentAgent, setCurrentAgent] = useState<string | undefined>(initialAgent);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Realtime session context (optional)
  const realtimeSession = useOptionalRealtimeSession();

  // Chat hook with realtime session integration
  const chat = useChat({
    enableRealtimeSession: !!realtimeSession,
    enablePersistence: true,
    maxMessages: 1000,
    onAgentHandoff: (agentName: string) => {
      const agent = agents.find(a => a.name === agentName || a.id === agentName);
      if (agent) {
        handleAgentChange(agent.id);
      }
    },
  });

  const handleAgentChange = useCallback((agentId: string) => {
    setCurrentAgent(agentId);
    onAgentChange?.(agentId);
    
    // If using realtime session, switch agent there too
    if (realtimeSession?.switchAgent) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        realtimeSession.switchAgent(agent.name).catch(console.error);
      }
    }

    // Switch agent in chat hook
    if (chat.switchAgent) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        chat.switchAgent(agent.name).catch(console.error);
      }
    }
  }, [agents, onAgentChange, realtimeSession, chat]);

  const handleVoiceTranscription = useCallback((text: string) => {
    if (text.trim()) {
      chat.sendMessage(text);
    }
  }, [chat]);

  const toggleVoiceMode = useCallback(() => {
    setIsVoiceMode(prev => !prev);
    if (realtimeSession?.toggleVoice) {
      realtimeSession.toggleVoice();
    }
  }, [realtimeSession]);

  const currentAgentData = agents.find(agent => agent.id === currentAgent);

  return (
    <div className={`chat-layout flex h-screen bg-gray-100 ${className}`}>
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:w-80
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h1 className="text-lg font-semibold text-gray-800">
              {title}
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Agent Selector */}
          {showAgentSelector && (
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Agent
              </label>
              <AgentSelector
                agents={agents}
                currentAgent={currentAgent}
                onAgentChange={handleAgentChange}
                disabled={chat.isLoading}
                showDescriptions={true}
              />
            </div>
          )}

          {/* Connection Status */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Connection
              </span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  realtimeSession?.sessionState.status === 'CONNECTED' || chat.isConnected
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }`} />
                <span className="text-xs text-gray-600">
                  {realtimeSession?.sessionState.status === 'CONNECTED' ? 'Realtime' :
                   chat.isConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
            
            {realtimeSession?.sessionState.error && (
              <div className="mt-2 text-xs text-red-600">
                {realtimeSession.sessionState.error}
              </div>
            )}
          </div>

          {/* Voice Controls */}
          {showVoiceControls && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Voice Mode
                </label>
                <button
                  onClick={toggleVoiceMode}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isVoiceMode ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                >
                  <span className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${isVoiceMode ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </button>
              </div>
              
              {isVoiceMode && (
                <VoiceControls
                  onTranscription={handleVoiceTranscription}
                  mode="push-to-talk"
                  showVisualizer={false}
                  disabled={chat.isLoading}
                  className="mt-3"
                />
              )}
            </div>
          )}

          {/* Chat Stats */}
          <div className="p-4 border-b border-gray-200">
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Messages:</span>
                <span>{chat.messages.length}</span>
              </div>
              {currentAgentData && (
                <div className="flex justify-between">
                  <span>Current Agent:</span>
                  <span className="font-medium">{currentAgentData.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 p-4 space-y-2">
            <button
              onClick={chat.clearMessages}
              disabled={chat.messages.length === 0 || chat.isLoading}
              className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Conversation
            </button>
            
            {realtimeSession && (
              <button
                onClick={() => {
                  if (realtimeSession.sessionState.status === 'CONNECTED') {
                    realtimeSession.disconnect();
                  } else {
                    // Would need connection options to reconnect
                    realtimeSession.reconnect?.().catch(console.error);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {realtimeSession.sessionState.status === 'CONNECTED' 
                  ? 'Disconnect' 
                  : 'Reconnect'
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {currentAgentData?.name || 'Chat'}
          </h1>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            title={currentAgentData?.name}
            agentName={currentAgentData?.name}
            onAgentHandoff={(agentName) => {
              const agent = agents.find(a => a.name === agentName);
              if (agent) {
                handleAgentChange(agent.id);
              }
            }}
            className="h-full"
          />
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};