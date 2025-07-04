'use client';

import React, { useState, useCallback } from 'react';
import { useVoiceRecording, usePushToTalk } from '@/hooks/useVoiceRecording';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useVoiceActivity } from '@/hooks/useVoiceActivity';

export interface VoiceControlsProps {
  onTranscription?: (text: string) => void;
  onAudio?: (blob: Blob) => void;
  className?: string;
  mode?: 'manual' | 'push-to-talk' | 'auto';
  showVisualizer?: boolean;
  disabled?: boolean;
}

export const VoiceControls = ({
  onTranscription,
  onAudio,
  className = '',
  mode = 'manual',
  showVisualizer = true,
  disabled = false,
}: VoiceControlsProps) => {
  const [selectedMode, setSelectedMode] = useState(mode);

  // Manual recording hook
  const manualRecording = useVoiceRecording();
  
  // Push-to-talk hook
  const pushToTalk = usePushToTalk({
    onTranscription,
    onAudio,
  });

  // Voice activity detection hook
  const voiceActivity = useVoiceActivity({
    onSpeechStart: () => console.log('Speech started'),
    onSpeechEnd: () => console.log('Speech ended'),
  });

  // Audio playback for feedback
  const audioPlayback = useAudioPlayback();

  const handleManualRecord = useCallback(async () => {
    if (manualRecording.isRecording) {
      const audioBlob = await manualRecording.stopRecording();
      if (audioBlob && onAudio) {
        onAudio(audioBlob);
      }
    } else {
      await manualRecording.startRecording();
    }
  }, [manualRecording, onAudio]);

  const handleModeChange = useCallback((newMode: typeof mode) => {
    // Stop any current recording when switching modes
    if (manualRecording.isRecording) {
      manualRecording.stopRecording();
    }
    if (pushToTalk.isRecording) {
      pushToTalk.handlePressEnd();
    }
    if (voiceActivity.isListening) {
      voiceActivity.stopListening();
    }

    setSelectedMode(newMode);
  }, [manualRecording, pushToTalk, voiceActivity]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getActiveRecording = () => {
    switch (selectedMode) {
      case 'manual':
        return manualRecording;
      case 'push-to-talk':
        return pushToTalk;
      case 'auto':
        return voiceActivity;
      default:
        return manualRecording;
    }
  };

  const activeRecording = getActiveRecording();

  return (
    <div className={`voice-controls bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Mode Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recording Mode
        </label>
        <div className="flex space-x-2">
          {[{ key: 'manual', label: 'Manual' }, { key: 'push-to-talk', label: 'Push to Talk' }, { key: 'auto', label: 'Auto Detect' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleModeChange(key as typeof mode)}
              disabled={disabled}
              className={`
                px-3 py-2 rounded text-sm font-medium transition-colors
                ${
                  selectedMode === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="mb-4">
        {selectedMode === 'manual' && (
          <div className="flex items-center space-x-4">
            <button
              onClick={handleManualRecord}
              disabled={disabled || Boolean(manualRecording.error)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  manualRecording.isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <div className={`w-3 h-3 rounded-full ${
                manualRecording.isRecording ? 'bg-white animate-pulse' : 'bg-white'
              }`} />
              <span>
                {manualRecording.isRecording ? 'Stop Recording' : 'Start Recording'}
              </span>
            </button>
            
            {manualRecording.isRecording && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={manualRecording.isPaused ? manualRecording.resumeRecording : manualRecording.pauseRecording}
                  className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  {manualRecording.isPaused ? 'Resume' : 'Pause'}
                </button>
                <span className="text-sm text-gray-600">
                  {formatDuration(manualRecording.duration)}
                </span>
              </div>
            )}
          </div>
        )}

        {selectedMode === 'push-to-talk' && (
          <div className="text-center">
            <button
              onMouseDown={pushToTalk.handlePressStart}
              onMouseUp={pushToTalk.handlePressEnd}
              onTouchStart={pushToTalk.handlePressStart}
              onTouchEnd={pushToTalk.handlePressEnd}
              disabled={disabled}
              className={`
                w-20 h-20 rounded-full flex items-center justify-center font-medium transition-colors
                ${
                  pushToTalk.isPressed
                    ? 'bg-red-500 text-white scale-110'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                transform transition-transform
              `}
            >
              🎤
            </button>
            <p className="text-sm text-gray-600 mt-2">
              {pushToTalk.isPressed ? 'Recording...' : 'Hold to record or press Space'}
            </p>
            {pushToTalk.isTranscribing && (
              <p className="text-sm text-blue-600 mt-1">Transcribing...</p>
            )}
          </div>
        )}

        {selectedMode === 'auto' && (
          <div className="text-center">
            <button
              onClick={voiceActivity.isListening ? voiceActivity.stopListening : voiceActivity.startListening}
              disabled={disabled}
              className={`
                px-6 py-3 rounded-lg font-medium transition-colors
                ${
                  voiceActivity.isListening
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {voiceActivity.isListening ? 'Stop Listening' : 'Start Auto Detection'}
            </button>
            
            {voiceActivity.isListening && (
              <div className="mt-3">
                <div className={`
                  w-4 h-4 rounded-full mx-auto mb-2 transition-colors
                  ${voiceActivity.isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}
                `} />
                <p className="text-sm text-gray-600">
                  {voiceActivity.isSpeaking ? 'Speech detected' : 'Listening...'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio Level Visualizer */}
      {showVisualizer && (selectedMode === 'manual' || selectedMode === 'auto') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audio Level
          </label>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-100"
              style={{
                width: `${(
                  selectedMode === 'manual' ? manualRecording.level :
                  selectedMode === 'auto' ? voiceActivity.audioLevel :
                  0
                ) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {activeRecording.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">Recording Error</p>
              <p className="text-xs text-red-600 mt-1">{activeRecording.error.message}</p>
            </div>
            <button
              onClick={activeRecording.clearError}
              className="text-red-500 hover:text-red-700 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Transcription Display */}
      {selectedMode === 'push-to-talk' && pushToTalk.transcription && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-blue-700 mb-1">
            Transcription
          </label>
          <p className="text-sm text-blue-800">{pushToTalk.transcription}</p>
          <button
            onClick={pushToTalk.clearTranscription}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Voice Activity Metrics */}
      {selectedMode === 'auto' && voiceActivity.isListening && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Speech Time</p>
            <p className="text-sm font-medium">
              {Math.round(voiceActivity.metrics.totalSpeechTime / 1000)}s
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Silence Time</p>
            <p className="text-sm font-medium">
              {Math.round(voiceActivity.metrics.totalSilenceTime / 1000)}s
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">Segments</p>
            <p className="text-sm font-medium">
              {voiceActivity.metrics.speechSegments}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
