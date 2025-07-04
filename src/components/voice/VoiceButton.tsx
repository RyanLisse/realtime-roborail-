import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePushToTalk } from '../../hooks/useVoiceRecording';
import { VoiceButtonProps } from '../../lib/audio/types';

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onPress,
  onRelease,
  onTranscription,
  onError,
  disabled = false,
  size = 'medium',
  variant = 'primary',
  theme = 'dark',
  pushToTalk = true,
  showLevel = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const pushToTalkConfig = usePushToTalk({
    onTranscription: (text) => {
      onTranscription?.(text);
    },
    transcription: {
      enhance: true,
      language: 'en',
    },
  });

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    setIsPressed(true);
    onPress?.();
    
    if (pushToTalk) {
      pushToTalkConfig.handlePressStart();
    }
  }, [disabled, onPress, pushToTalk, pushToTalkConfig]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    setIsPressed(false);
    onRelease?.();
    
    if (pushToTalk) {
      pushToTalkConfig.handlePressEnd();
    }
  }, [disabled, onRelease, pushToTalk, pushToTalkConfig]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    setIsPressed(true);
    onPress?.();
    
    if (pushToTalk) {
      pushToTalkConfig.handlePressStart();
    }
  }, [disabled, onPress, pushToTalk, pushToTalkConfig]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    setIsPressed(false);
    onRelease?.();
    
    if (pushToTalk) {
      pushToTalkConfig.handlePressEnd();
    }
  }, [disabled, onRelease, pushToTalk, pushToTalkConfig]);

  const handleClick = useCallback(() => {
    if (disabled || pushToTalk) return;
    
    if (!pushToTalkConfig.isRecording) {
      pushToTalkConfig.startRecording();
    } else {
      pushToTalkConfig.stopRecordingAndTranscribe();
    }
  }, [disabled, pushToTalk, pushToTalkConfig]);

  // Handle errors
  useEffect(() => {
    if (pushToTalkConfig.error || pushToTalkConfig.transcriptionError) {
      const error = pushToTalkConfig.error || pushToTalkConfig.transcriptionError;
      onError?.(error as any);
    }
  }, [pushToTalkConfig.error, pushToTalkConfig.transcriptionError, onError]);

  // Prevent context menu on long press
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-12 h-12 p-2';
      case 'large':
        return 'w-20 h-20 p-4';
      case 'medium':
      default:
        return 'w-16 h-16 p-3';
    }
  };

  const getVariantClasses = () => {
    const isActive = isPressed || (pushToTalkConfig.isRecording && !pushToTalk);
    
    if (variant === 'outline') {
      return theme === 'dark'
        ? `border-2 ${isActive ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-gray-600 text-gray-300 hover:border-gray-500'}`
        : `border-2 ${isActive ? 'border-red-500 bg-red-500/20 text-red-600' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`;
    }
    
    if (variant === 'secondary') {
      return theme === 'dark'
        ? `${isActive ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`
        : `${isActive ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`;
    }
    
    // Primary variant
    return theme === 'dark'
      ? `${isActive ? 'bg-red-600 text-white shadow-lg shadow-red-500/25' : 'bg-blue-600 text-white hover:bg-blue-700'}`
      : `${isActive ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' : 'bg-blue-500 text-white hover:bg-blue-600'}`;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'large':
        return 'w-8 h-8';
      case 'medium':
      default:
        return 'w-6 h-6';
    }
  };

  const renderIcon = () => {
    const iconClasses = getIconSize();
    const isActive = isPressed || (pushToTalkConfig.isRecording && !pushToTalk);
    
    if (pushToTalkConfig.isTranscribing) {
      return (
        <svg className={`${iconClasses} animate-spin`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }
    
    if (isActive) {
      return (
        <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
      </svg>
    );
  };

  const buttonClasses = `
    ${getSizeClasses()}
    ${getVariantClasses()}
    rounded-full
    transition-all duration-200
    flex items-center justify-center
    relative
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
    ${isPressed || (pushToTalkConfig.isRecording && !pushToTalk) ? 'animate-pulse' : ''}
    focus:outline-none focus:ring-4 focus:ring-opacity-50
    ${theme === 'dark' ? 'focus:ring-blue-500' : 'focus:ring-blue-300'}
  `;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={buttonClasses}
        onMouseDown={pushToTalk ? handleMouseDown : undefined}
        onMouseUp={pushToTalk ? handleMouseUp : undefined}
        onMouseLeave={pushToTalk ? handleMouseUp : undefined}
        onTouchStart={pushToTalk ? handleTouchStart : undefined}
        onTouchEnd={pushToTalk ? handleTouchEnd : undefined}
        onClick={!pushToTalk ? handleClick : undefined}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        aria-label={
          pushToTalk 
            ? (isPressed ? 'Recording... Release to stop' : 'Hold to record') 
            : (pushToTalkConfig.isRecording ? 'Stop recording' : 'Start recording')
        }
        aria-pressed={isPressed || pushToTalkConfig.isRecording}
      >
        {renderIcon()}
        
        {/* Recording indicator */}
        {(isPressed || (pushToTalkConfig.isRecording && !pushToTalk)) && (
          <div className="absolute -top-1 -right-1">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
        )}
      </button>

      {/* Audio level indicator */}
      {showLevel && (isPressed || pushToTalkConfig.isRecording) && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className={`w-8 h-1 rounded-full overflow-hidden ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
          }`}>
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${pushToTalkConfig.level * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Tooltip */}
      {isHovered && !disabled && (
        <div className={`
          absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
          px-2 py-1 text-xs rounded whitespace-nowrap
          ${theme === 'dark' 
            ? 'bg-gray-800 text-gray-200 border border-gray-700' 
            : 'bg-gray-900 text-gray-100'
          }
          pointer-events-none z-10
        `}>
          {pushToTalk 
            ? 'Hold to record' 
            : (pushToTalkConfig.isRecording ? 'Click to stop' : 'Click to record')
          }
          <div className={`
            absolute top-full left-1/2 transform -translate-x-1/2
            border-4 border-transparent
            ${theme === 'dark' ? 'border-t-gray-800' : 'border-t-gray-900'}
          `} />
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {pushToTalk && isHovered && !disabled && (
        <div className={`
          absolute top-full left-1/2 transform -translate-x-1/2 mt-2
          px-2 py-1 text-xs rounded whitespace-nowrap
          ${theme === 'dark' 
            ? 'bg-gray-800 text-gray-400 border border-gray-700' 
            : 'bg-gray-100 text-gray-600 border border-gray-300'
          }
          pointer-events-none z-10
        `}>
          Press Space to record
          <div className={`
            absolute bottom-full left-1/2 transform -translate-x-1/2
            border-4 border-transparent
            ${theme === 'dark' ? 'border-b-gray-800' : 'border-b-gray-100'}
          `} />
        </div>
      )}

      {/* Transcription display */}
      {pushToTalkConfig.transcription && (
        <div className={`
          absolute top-full left-1/2 transform -translate-x-1/2 mt-4
          max-w-xs p-3 rounded border text-sm
          ${theme === 'dark'
            ? 'bg-gray-800 border-gray-700 text-gray-200'
            : 'bg-white border-gray-300 text-gray-800'
          }
          shadow-lg z-20
        `}>
          <div className="font-medium mb-1">Transcription:</div>
          <div>{pushToTalkConfig.transcription}</div>
          <button
            onClick={pushToTalkConfig.clearTranscription}
            className={`
              mt-2 text-xs underline hover:no-underline
              ${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}
            `}
          >
            Clear
          </button>
        </div>
      )}

      {/* Error display */}
      {(pushToTalkConfig.error || pushToTalkConfig.transcriptionError) && (
        <div className={`
          absolute top-full left-1/2 transform -translate-x-1/2 mt-4
          max-w-xs p-3 rounded border text-sm
          ${theme === 'dark'
            ? 'bg-red-900/20 border-red-800 text-red-200'
            : 'bg-red-50 border-red-200 text-red-800'
          }
          shadow-lg z-20
        `}>
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{(pushToTalkConfig.error || pushToTalkConfig.transcriptionError)?.message}</span>
          </div>
          <button
            onClick={() => {
              pushToTalkConfig.clearError();
              pushToTalkConfig.clearTranscription();
            }}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};