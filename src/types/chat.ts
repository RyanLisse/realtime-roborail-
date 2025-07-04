export interface Citation {
  id: string;
  text: string;
  source: string;
  confidence: number;
  page?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  agentName?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'completed' | 'failed';
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  currentAgent?: string;
}

export interface ChatHook {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  currentAgent?: string;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  reconnect?: () => Promise<void>;
  switchAgent?: (agentName: string) => Promise<void>;
}

export interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  maxLength?: number;
  showCharCount?: boolean;
  onTyping?: (isTyping: boolean) => void;
  voiceEnabled?: boolean;
}

export interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onAgentHandoff?: (agentName: string) => void;
  emptyStateMessage?: string;
}

export interface ChatInterfaceProps {
  className?: string;
  title?: string;
  onAgentHandoff?: (agentName: string) => void;
  agentName?: string;
}

// Realtime session related types
export interface RealtimeSessionState {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  error?: string;
  currentAgent?: string;
  isVoiceEnabled?: boolean;
}

export interface RealtimeSessionHook {
  sessionState: RealtimeSessionState;
  connect: (options: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: string) => void;
  switchAgent: (agentName: string) => Promise<void>;
  toggleVoice: () => void;
  mute: (muted: boolean) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: any[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}