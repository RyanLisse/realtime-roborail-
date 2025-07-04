import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VoiceActivityDetector, 
  VADConfig, 
  VADResult, 
  UseVoiceActivityReturn 
} from '../lib/audio';

export function useVoiceActivity(config?: VADConfig): UseVoiceActivityReturn {
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [speechDuration, setSpeechDuration] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize VAD
  useEffect(() => {
    const initVAD = async () => {
      try {
        const { createVAD } = await import('../lib/audio');
        vadRef.current = createVAD(config);
      } catch (err) {
        console.error('Failed to initialize VAD:', err);
      }
    };

    initVAD();

    return () => {
      if (vadRef.current) {
        vadRef.current.cleanup();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [config]);

  const startListening = useCallback(async (): Promise<void> => {
    if (!vadRef.current || isListening) {
      return;
    }

    try {
      // Get microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      mediaStreamRef.current = mediaStream;

      // Start VAD with callback to update state
      await vadRef.current.startListening(mediaStream, (result: VADResult) => {
        setIsSpeechActive(result.isSpeechActive);
        setConfidence(result.confidence);
        setSilenceDuration(result.silenceDuration);
        setSpeechDuration(result.speechDuration);
      });

      setIsListening(true);
    } catch (err) {
      console.error('Failed to start voice activity detection:', err);
      throw err;
    }
  }, [isListening]);

  const stopListening = useCallback((): void => {
    if (vadRef.current && isListening) {
      vadRef.current.stopListening();
      setIsListening(false);
      
      // Reset state
      setIsSpeechActive(false);
      setConfidence(0);
      setSilenceDuration(0);
      setSpeechDuration(0);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, [isListening]);

  const configure = useCallback((newConfig: VADConfig): void => {
    if (vadRef.current) {
      vadRef.current.configure(newConfig);
    }
  }, []);

  return {
    isSpeechActive,
    confidence,
    silenceDuration,
    speechDuration,
    isListening,
    startListening,
    stopListening,
    configure,
  };
}

// Hook for voice activity with callbacks
export function useVoiceActivityWithCallbacks(config?: {
  vad?: VADConfig;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSilenceStart?: () => void;
  onSilenceEnd?: () => void;
  onActivityChange?: (result: VADResult) => void;
}) {
  const vad = useVoiceActivity(config?.vad);
  const [lastSpeechState, setLastSpeechState] = useState(false);
  const [lastSilenceTime, setLastSilenceTime] = useState(0);

  // Handle speech state changes
  useEffect(() => {
    if (vad.isSpeechActive !== lastSpeechState) {
      if (vad.isSpeechActive) {
        config?.onSpeechStart?.();
        if (lastSilenceTime > 0) {
          config?.onSilenceEnd?.();
        }
      } else {
        config?.onSpeechEnd?.();
        config?.onSilenceStart?.();
        setLastSilenceTime(Date.now());
      }
      setLastSpeechState(vad.isSpeechActive);
    }
  }, [vad.isSpeechActive, lastSpeechState, lastSilenceTime, config]);

  // Handle activity changes
  useEffect(() => {
    if (vad.isListening) {
      config?.onActivityChange?.({
        isSpeechActive: vad.isSpeechActive,
        confidence: vad.confidence,
        silenceDuration: vad.silenceDuration,
        speechDuration: vad.speechDuration,
      });
    }
  }, [vad, config]);

  return vad;
}

// Hook for voice-triggered recording
export function useVoiceTriggerRecording(config?: {
  vad?: VADConfig;
  recording?: {
    autoStart?: boolean;
    autoStop?: boolean;
    minRecordingDuration?: number;
    maxRecordingDuration?: number;
    silenceTimeout?: number;
  };
  onRecordingStart?: () => void;
  onRecordingStop?: (audioBlob: Blob) => void;
  onTranscription?: (text: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [silenceStartTime, setSilenceStartTime] = useState(0);
  
  const recorderRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);

  const vad = useVoiceActivityWithCallbacks({
    vad: config?.vad,
    onSpeechStart: async () => {
      // Start recording when speech is detected
      if (config?.recording?.autoStart && !isRecording) {
        await startRecording();
      }
      setSilenceStartTime(0);
    },
    onSpeechEnd: () => {
      setSilenceStartTime(Date.now());
    },
    onSilenceStart: () => {
      // Set timeout to stop recording after silence
      if (isRecording && config?.recording?.autoStop) {
        const timeout = config.recording.silenceTimeout || 2000;
        timeoutRef.current = window.setTimeout(() => {
          stopRecording();
        }, timeout);
      }
    },
    onSilenceEnd: () => {
      // Cancel timeout if speech resumes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    },
  });

  // Initialize recorder
  useEffect(() => {
    const initRecorder = async () => {
      const { AudioRecorder } = await import('../lib/audio');
      recorderRef.current = new AudioRecorder();
    };

    initRecorder();

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanup();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!recorderRef.current || isRecording) return;

    try {
      await recorderRef.current.requestMicrophoneAccess();
      await recorderRef.current.startRecording();
      
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      config?.onRecordingStart?.();

      // Set maximum recording duration timeout
      if (config?.recording?.maxRecordingDuration) {
        setTimeout(() => {
          if (isRecording) {
            stopRecording();
          }
        }, config.recording.maxRecordingDuration);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [isRecording, config]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      // Check minimum recording duration
      const recordingDuration = Date.now() - recordingStartTime;
      const minDuration = config?.recording?.minRecordingDuration || 500;
      
      if (recordingDuration < minDuration) {
        // Wait for minimum duration
        setTimeout(() => stopRecording(), minDuration - recordingDuration);
        return;
      }

      const audioBlob = await recorderRef.current.stopRecording();
      setIsRecording(false);
      setRecordingStartTime(0);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      config?.onRecordingStop?.(audioBlob);

      // Auto-transcribe if callback provided
      if (config?.onTranscription) {
        try {
          const { transcribeAudio } = await import('../lib/audio');
          const result = await transcribeAudio(audioBlob);
          config.onTranscription(result.text);
        } catch (err) {
          console.error('Failed to transcribe:', err);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }, [isRecording, recordingStartTime, config]);

  const manualStartRecording = useCallback(async () => {
    await startRecording();
  }, [startRecording]);

  const manualStopRecording = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  return {
    ...vad,
    isRecording,
    startRecording: manualStartRecording,
    stopRecording: manualStopRecording,
  };
}

// Hook for advanced voice activity analytics
export function useVoiceActivityAnalytics(config?: VADConfig) {
  const vad = useVoiceActivity(config);
  const [analytics, setAnalytics] = useState({
    totalSpeechTime: 0,
    totalSilenceTime: 0,
    speechEvents: 0,
    averageConfidence: 0,
    lastActivityTime: 0,
  });

  const analyticsRef = useRef({
    sessionStartTime: 0,
    speechEvents: 0,
    confidenceSum: 0,
    confidenceCount: 0,
    lastSpeechState: false,
  });

  // Track analytics
  useEffect(() => {
    if (vad.isListening && analyticsRef.current.sessionStartTime === 0) {
      analyticsRef.current.sessionStartTime = Date.now();
    }

    if (vad.isSpeechActive !== analyticsRef.current.lastSpeechState) {
      if (vad.isSpeechActive) {
        analyticsRef.current.speechEvents++;
      }
      analyticsRef.current.lastSpeechState = vad.isSpeechActive;
    }

    // Update confidence tracking
    if (vad.isListening) {
      analyticsRef.current.confidenceSum += vad.confidence;
      analyticsRef.current.confidenceCount++;
    }

    // Update analytics state
    setAnalytics({
      totalSpeechTime: vad.speechDuration,
      totalSilenceTime: vad.silenceDuration,
      speechEvents: analyticsRef.current.speechEvents,
      averageConfidence: analyticsRef.current.confidenceCount > 0 
        ? analyticsRef.current.confidenceSum / analyticsRef.current.confidenceCount 
        : 0,
      lastActivityTime: vad.isSpeechActive ? Date.now() : 0,
    });
  }, [vad]);

  const resetAnalytics = useCallback(() => {
    analyticsRef.current = {
      sessionStartTime: Date.now(),
      speechEvents: 0,
      confidenceSum: 0,
      confidenceCount: 0,
      lastSpeechState: false,
    };
    setAnalytics({
      totalSpeechTime: 0,
      totalSilenceTime: 0,
      speechEvents: 0,
      averageConfidence: 0,
      lastActivityTime: 0,
    });
  }, []);

  const getSessionDuration = useCallback(() => {
    return analyticsRef.current.sessionStartTime > 0 
      ? Date.now() - analyticsRef.current.sessionStartTime 
      : 0;
  }, []);

  const getSpeechRatio = useCallback(() => {
    const sessionDuration = getSessionDuration();
    return sessionDuration > 0 ? analytics.totalSpeechTime / sessionDuration : 0;
  }, [analytics.totalSpeechTime, getSessionDuration]);

  return {
    ...vad,
    analytics,
    resetAnalytics,
    getSessionDuration,
    getSpeechRatio,
  };
}