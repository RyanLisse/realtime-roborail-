import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AudioRecorder, 
  AudioRecorderConfig, 
  RecordingError, 
  UseVoiceRecordingReturn 
} from '../lib/audio';

export function useVoiceRecording(config?: AudioRecorderConfig): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<RecordingError | null>(null);
  
  const recorderRef = useRef<AudioRecorder | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const levelIntervalRef = useRef<number | null>(null);

  // Initialize recorder
  useEffect(() => {
    try {
      recorderRef.current = new AudioRecorder(config);
    } catch (err) {
      setError(new RecordingError(`Failed to initialize recorder: ${err.message}`));
    }

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanup();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
      }
    };
  }, [config]);

  const startRecording = useCallback(async (): Promise<void> => {
    if (!recorderRef.current) {
      setError(new RecordingError('Recorder not initialized'));
      return;
    }

    try {
      setError(null);
      
      // Request microphone access if not already granted
      await recorderRef.current.requestMicrophoneAccess();
      
      // Start recording
      await recorderRef.current.startRecording();
      
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setDuration(recorderRef.current.getRecordingDuration());
        }
      }, 100);

      // Start level monitoring
      levelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setLevel(recorderRef.current.getRMSLevel());
        }
      }, 50);

    } catch (err) {
      setError(new RecordingError(`Failed to start recording: ${err.message}`));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current || !isRecording) {
      return null;
    }

    try {
      const audioBlob = await recorderRef.current.stopRecording();
      
      setIsRecording(false);
      setIsPaused(false);
      setLevel(0);

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
        levelIntervalRef.current = null;
      }

      return audioBlob;
    } catch (err) {
      setError(new RecordingError(`Failed to stop recording: ${err.message}`));
      return null;
    }
  }, [isRecording]);

  const pauseRecording = useCallback((): void => {
    if (!recorderRef.current || !isRecording || isPaused) {
      return;
    }

    try {
      recorderRef.current.pauseRecording();
      setIsPaused(true);
      
      // Pause timers
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
        levelIntervalRef.current = null;
      }
    } catch (err) {
      setError(new RecordingError(`Failed to pause recording: ${err.message}`));
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback((): void => {
    if (!recorderRef.current || !isRecording || !isPaused) {
      return;
    }

    try {
      recorderRef.current.resumeRecording();
      setIsPaused(false);

      // Resume timers
      durationIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setDuration(recorderRef.current.getRecordingDuration());
        }
      }, 100);

      levelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setLevel(recorderRef.current.getRMSLevel());
        }
      }, 50);
    } catch (err) {
      setError(new RecordingError(`Failed to resume recording: ${err.message}`));
    }
  }, [isRecording, isPaused]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    level,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearError,
  };
}

// Hook for voice recording with automatic transcription
export function useVoiceRecordingWithTranscription(config?: {
  recording?: AudioRecorderConfig;
  transcription?: {
    language?: string;
    enhance?: boolean;
    compress?: boolean;
  };
}) {
  const recording = useVoiceRecording(config?.recording);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<Error | null>(null);

  const stopRecordingAndTranscribe = useCallback(async (): Promise<{
    audio: Blob | null;
    transcription: string;
  }> => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    
    try {
      const audioBlob = await recording.stopRecording();
      
      if (audioBlob) {
        const { transcribeAudio } = await import('../lib/audio');
        const result = await transcribeAudio(audioBlob, config?.transcription);
        
        setTranscription(result.text);
        return { audio: audioBlob, transcription: result.text };
      }
      
      return { audio: null, transcription: '' };
    } catch (err) {
      setTranscriptionError(err as Error);
      return { audio: null, transcription: '' };
    } finally {
      setIsTranscribing(false);
    }
  }, [recording, config?.transcription]);

  const clearTranscription = useCallback(() => {
    setTranscription('');
    setTranscriptionError(null);
  }, []);

  return {
    ...recording,
    transcription,
    isTranscribing,
    transcriptionError,
    stopRecordingAndTranscribe,
    clearTranscription,
  };
}

// Hook for push-to-talk functionality
export function usePushToTalk(config?: {
  recording?: AudioRecorderConfig;
  onTranscription?: (text: string) => void;
  onAudio?: (blob: Blob) => void;
  transcription?: {
    language?: string;
    enhance?: boolean;
  };
}) {
  const recording = useVoiceRecordingWithTranscription({
    recording: config?.recording,
    transcription: config?.transcription,
  });
  
  const [isPressed, setIsPressed] = useState(false);

  const handlePressStart = useCallback(async () => {
    if (isPressed) return;
    
    setIsPressed(true);
    await recording.startRecording();
  }, [isPressed, recording]);

  const handlePressEnd = useCallback(async () => {
    if (!isPressed) return;
    
    setIsPressed(false);
    const result = await recording.stopRecordingAndTranscribe();
    
    if (result.audio && config?.onAudio) {
      config.onAudio(result.audio);
    }
    
    if (result.transcription && config?.onTranscription) {
      config.onTranscription(result.transcription);
    }
  }, [isPressed, recording, config]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        handlePressStart();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handlePressEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePressStart, handlePressEnd]);

  return {
    ...recording,
    isPressed,
    handlePressStart,
    handlePressEnd,
  };
}

// Hook for automatic voice recording with VAD
export function useAutomaticVoiceRecording(config?: {
  recording?: AudioRecorderConfig;
  vad?: {
    threshold?: number;
    minSilenceDuration?: number;
    maxSilenceDuration?: number;
  };
  onRecordingComplete?: (audio: Blob) => void;
  onTranscription?: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
  
  const recording = useVoiceRecordingWithTranscription({
    recording: config?.recording,
  });

  const vadRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    try {
      setIsListening(true);
      
      // Initialize VAD
      const { createVAD, getOptimalVADConfig } = await import('../lib/audio');
      vadRef.current = createVAD(config?.vad || getOptimalVADConfig('conversation'));
      
      // Start VAD monitoring
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await vadRef.current.startListening(mediaStream, async (result: any) => {
        if (result.isSpeechActive && !recording.isRecording) {
          // Speech detected, start recording
          await recording.startRecording();
        } else if (!result.isSpeechActive && recording.isRecording && 
                   result.silenceDuration > (config?.vad?.minSilenceDuration || 1000)) {
          // Silence detected, stop recording
          const recordingResult = await recording.stopRecordingAndTranscribe();
          
          if (recordingResult.audio) {
            setCurrentRecording(recordingResult.audio);
            config?.onRecordingComplete?.(recordingResult.audio);
          }
          
          if (recordingResult.transcription) {
            config?.onTranscription?.(recordingResult.transcription);
          }
        }
      });
      
    } catch (err) {
      console.error('Failed to start automatic voice recording:', err);
      setIsListening(false);
    }
  }, [recording, config]);

  const stopListening = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.stopListening();
      vadRef.current = null;
    }
    
    if (recording.isRecording) {
      recording.stopRecording();
    }
    
    setIsListening(false);
  }, [recording]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...recording,
    isListening,
    currentRecording,
    startListening,
    stopListening,
  };
}