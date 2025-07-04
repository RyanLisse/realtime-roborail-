import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
  onReconnect?: () => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
  retryAttempts?: number;
  retryDelay?: number;
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus, error?: Error) => {
      setStatus(s);
      if (error) {
        setLastError(error);
        callbacks.onError?.(error);
      }
      callbacks.onConnectionChange?.(s);
      logClientEvent({ error: error?.message }, s);
    },
    [callbacks, logClientEvent],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      } 
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = useCallback((item: any) => {
    try {
      const history = item.context.history;
      const lastMessage = history[history.length - 1];
      const agentName = lastMessage.name.split("transfer_to_")[1];
      setCurrentAgent(agentName);
      callbacks.onAgentHandoff?.(agentName);
    } catch (error) {
      console.error('Error handling agent handoff:', error);
    }
  }, [callbacks]);

  const switchAgent = useCallback(async (agentName: string) => {
    if (!sessionRef.current) {
      throw new Error('No active session to switch agent');
    }
    
    try {
      // TODO: Implement agent switching logic with the session
      setCurrentAgent(agentName);
      callbacks.onAgentHandoff?.(agentName);
    } catch (error) {
      console.error('Failed to switch agent:', error);
      throw error;
    }
  }, [callbacks]);

  const reconnect = useCallback(async () => {
    if (!sessionRef.current) {
      throw new Error('No session to reconnect');
    }
    
    const lastOptions = {
      getEphemeralKey: async () => {
        // You'll need to store this from the original connect call
        throw new Error('Reconnect requires stored connection options');
      },
      initialAgents: [],
      retryAttempts: 1,
    };
    
    disconnect();
    await connect(lastOptions);
  }, []);

  useEffect(() => {
    if (sessionRef.current) {
      // Log server errors
      sessionRef.current.on("error", (...args: any[]) => {
        logServerEvent({
          type: "error",
          message: args[0],
        });
      });

      // history events
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);
      sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);

      // additional transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
    }
  }, [sessionRef.current]);

  const attemptReconnect = useCallback(
    async (options: ConnectOptions, attempt: number = 0) => {
      const maxRetries = options.retryAttempts ?? 3;
      const retryDelay = options.retryDelay ?? 1000;
      
      if (attempt >= maxRetries) {
        updateStatus('DISCONNECTED', new Error(`Failed to connect after ${maxRetries} attempts`));
        return;
      }
      
      try {
        await connect(options);
        setRetryCount(0);
        callbacks.onReconnect?.();
      } catch (error) {
        const nextAttempt = attempt + 1;
        setRetryCount(nextAttempt);
        
        if (nextAttempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            attemptReconnect(options, nextAttempt);
          }, delay);
        } else {
          updateStatus('DISCONNECTED', error as Error);
        }
      }
    },
    [callbacks],
  );

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
      retryAttempts = 3,
      retryDelay = 1000,
    }: ConnectOptions) => {
      if (sessionRef.current) {
        console.warn('Session already connected, disconnecting first');
        disconnect();
      }

      updateStatus('CONNECTING');
      setLastError(null);

      try {
        const ek = await getEphemeralKey();
        const rootAgent = initialAgents[0];
        setCurrentAgent(rootAgent.name || 'Unknown Agent');

        // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
        //  simulate how the voice agent sounds over a PSTN/SIP phone call.
        const codecParam = codecParamRef.current;
        const audioFormat = audioFormatForCodec(codecParam);

        sessionRef.current = new RealtimeSession(rootAgent, {
          transport: new OpenAIRealtimeWebRTC({
            audioElement,
            // Set preferred codec before offer creation
            changePeerConnection: async (pc: RTCPeerConnection) => {
              applyCodec(pc);
              return pc;
            },
          }),
          model: 'gpt-4o-realtime-preview-2025-06-03',
          config: {
            inputAudioFormat: audioFormat,
            outputAudioFormat: audioFormat,
            inputAudioTranscription: {
              model: 'gpt-4o-mini-transcribe',
            },
          },
          outputGuardrails: outputGuardrails ?? [],
          context: extraContext ?? {},
        });

        // Set up error handling
        sessionRef.current.on('error', (error: Error) => {
          updateStatus('DISCONNECTED', error);
          // Auto-reconnect on connection errors
          if (retryAttempts > 0) {
            attemptReconnect({ 
              getEphemeralKey, 
              initialAgents, 
              audioElement, 
              extraContext, 
              outputGuardrails,
              retryAttempts,
              retryDelay 
            });
          }
        });

        await sessionRef.current.connect({ apiKey: ek });
        updateStatus('CONNECTED');
        setRetryCount(0);
      } catch (error) {
        const err = error as Error;
        updateStatus('DISCONNECTED', err);
        
        // Auto-retry on initial connection failure
        if (retryAttempts > 0) {
          attemptReconnect({ 
            getEphemeralKey, 
            initialAgents, 
            audioElement, 
            extraContext, 
            outputGuardrails,
            retryAttempts,
            retryDelay 
          });
        }
        throw err;
      }
    },
    [updateStatus, attemptReconnect],
  );

  const disconnect = useCallback(() => {
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    sessionRef.current?.close();
    sessionRef.current = null;
    setCurrentAgent(null);
    setRetryCount(0);
    setLastError(null);
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      sessionRef.current?.close();
    };
  }, []);

  return {
    status,
    currentAgent,
    retryCount,
    lastError,
    connect,
    disconnect,
    reconnect,
    switchAgent,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
