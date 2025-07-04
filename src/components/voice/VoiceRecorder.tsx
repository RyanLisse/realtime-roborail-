import React, { useRef, useEffect, useState } from 'react';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { VoiceRecorderProps } from '../../lib/audio/types';
import { AudioVisualizer, createVisualizationTheme } from '../../lib/audio';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingStart,
  onRecordingStop,
  onRecordingPause,
  onRecordingResume,
  onError,
  onLevelChange,
  maxDuration = 300000, // 5 minutes default
  autoStop = true,
  enableVAD = false,
  showWaveform = true,
  theme = 'dark',
  disabled = false,
}) => {
  const recording = useVoiceRecording({
    sampleRate: 44100,
    channels: 2,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<AudioVisualizer | null>(null);
  const [isVisualizationActive, setIsVisualizationActive] = useState(false);
  const [vadState, setVadState] = useState({ 
    isSpeechActive: false, 
    confidence: 0 
  });

  // Initialize visualizer
  useEffect(() => {
    if (showWaveform) {
      const visualizer = new AudioVisualizer({
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        refreshRate: 60,
      });
      visualizerRef.current = visualizer;

      return () => {
        visualizer.cleanup();
      };
    }
  }, [showWaveform]);

  // Handle recording events
  useEffect(() => {
    if (recording.isRecording && !recording.isPaused) {
      onRecordingStart?.();
      
      // Start visualization if enabled
      if (showWaveform && canvasRef.current && visualizerRef.current) {
        startVisualization();
      }
      
      // Auto-stop after max duration
      if (autoStop && maxDuration > 0) {
        const timeout = setTimeout(async () => {
          await handleStopRecording();
        }, maxDuration);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [recording.isRecording, recording.isPaused, onRecordingStart, showWaveform, autoStop, maxDuration]);

  useEffect(() => {
    if (recording.error) {
      onError?.(recording.error);
    }
  }, [recording.error, onError]);

  useEffect(() => {
    onLevelChange?.(recording.level);
  }, [recording.level, onLevelChange]);

  const startVisualization = async () => {
    if (!visualizerRef.current || !canvasRef.current) return;

    try {
      // Get media stream for visualization
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await visualizerRef.current.connectToMediaStream(mediaStream);
      
      const theme_config = createVisualizationTheme(theme === 'dark' ? 'dark' : 'classic');
      
      visualizerRef.current.startVisualization((data) => {
        if (canvasRef.current) {
          visualizerRef.current!.renderWaveform(canvasRef.current, theme_config);
        }
      });
      
      setIsVisualizationActive(true);
    } catch (err) {
      console.error('Failed to start visualization:', err);
    }
  };

  const stopVisualization = () => {
    if (visualizerRef.current) {
      visualizerRef.current.stopVisualization();
      setIsVisualizationActive(false);
    }
  };

  const handleStartRecording = async () => {
    if (disabled) return;
    
    try {
      await recording.startRecording();
    } catch (err) {
      onError?.(err as any);
    }
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = await recording.stopRecording();
      stopVisualization();
      
      if (audioBlob) {
        onRecordingStop?.(audioBlob);
      }
    } catch (err) {
      onError?.(err as any);
    }
  };

  const handlePauseRecording = () => {
    try {
      recording.pauseRecording();
      stopVisualization();
      onRecordingPause?.();
    } catch (err) {
      onError?.(err as any);
    }
  };

  const handleResumeRecording = () => {
    try {
      recording.resumeRecording();
      if (showWaveform) {
        startVisualization();
      }
      onRecordingResume?.();
    } catch (err) {
      onError?.(err as any);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getLevelColor = (level: number): string => {
    if (level < 0.3) return theme === 'dark' ? '#4ade80' : '#16a34a';
    if (level < 0.7) return theme === 'dark' ? '#facc15' : '#ca8a04';
    return theme === 'dark' ? '#ef4444' : '#dc2626';
  };

  const containerClasses = `
    p-6 rounded-lg border
    ${theme === 'dark' 
      ? 'bg-gray-900 border-gray-700 text-white' 
      : 'bg-white border-gray-300 text-gray-900'
    }
  `;

  const buttonClasses = `
    px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const primaryButtonClasses = `
    ${buttonClasses}
    ${theme === 'dark'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white'
    }
  `;

  const secondaryButtonClasses = `
    ${buttonClasses}
    ${theme === 'dark'
      ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
    }
  `;

  const dangerButtonClasses = `
    ${buttonClasses}
    ${theme === 'dark'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-red-500 hover:bg-red-600 text-white'
    }
  `;

  return (
    <div className={containerClasses}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Voice Recorder</h3>
          {recording.isRecording && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-mono">
                {formatDuration(recording.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Waveform Visualization */}
        {showWaveform && (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={100}
              className={`w-full h-24 rounded border ${
                theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
              }`}
            />
            {!isVisualizationActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-gray-500">
                  {recording.isRecording ? 'Starting visualization...' : 'Waveform will appear when recording'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Audio Level Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Audio Level</span>
            <span>{Math.round(recording.level * 100)}%</span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div
              className="h-full transition-all duration-100 rounded-full"
              style={{
                width: `${recording.level * 100}%`,
                backgroundColor: getLevelColor(recording.level),
              }}
            />
          </div>
        </div>

        {/* VAD Indicator */}
        {enableVAD && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Voice Activity</span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  vadState.isSpeechActive ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span>{Math.round(vadState.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center space-x-3">
          {!recording.isRecording ? (
            <button
              onClick={handleStartRecording}
              disabled={disabled}
              className={primaryButtonClasses}
              aria-label="Start recording"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Start Recording
            </button>
          ) : (
            <>
              {!recording.isPaused ? (
                <button
                  onClick={handlePauseRecording}
                  className={secondaryButtonClasses}
                  aria-label="Pause recording"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleResumeRecording}
                  className={primaryButtonClasses}
                  aria-label="Resume recording"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Resume
                </button>
              )}
              
              <button
                onClick={handleStopRecording}
                className={dangerButtonClasses}
                aria-label="Stop recording"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop
              </button>
            </>
          )}
        </div>

        {/* Error Display */}
        {recording.error && (
          <div className={`p-3 rounded border text-sm ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-200'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{recording.error.message}</span>
              <button
                onClick={recording.clearError}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Recording Status */}
        {recording.duration > 0 && (
          <div className="text-xs text-center space-y-1">
            <div>Duration: {formatDuration(recording.duration)}</div>
            {maxDuration > 0 && (
              <div>
                Remaining: {formatDuration(Math.max(0, maxDuration - recording.duration))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};