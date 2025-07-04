import React, { useRef, useEffect, useState } from 'react';
import { useAudioPlayer } from '../../hooks/useAudioPlayback';
import { AudioPlayerProps } from '../../lib/audio/types';
import { AudioVisualizer, createVisualizationTheme } from '../../lib/audio';

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  autoPlay = false,
  loop = false,
  volume = 1.0,
  playbackRate = 1.0,
  onPlay,
  onPause,
  onEnd,
  onError,
  onTimeUpdate,
  showControls = true,
  showWaveform = false,
  theme = 'dark',
}) => {
  const player = useAudioPlayer(src, {
    volume,
    playbackRate,
    autoPlay,
    loop,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<AudioVisualizer | null>(null);
  const [isVisualizationActive, setIsVisualizationActive] = useState(false);

  // Initialize visualizer
  useEffect(() => {
    if (showWaveform) {
      const visualizer = new AudioVisualizer({
        fftSize: 1024,
        smoothingTimeConstant: 0.8,
        refreshRate: 30,
      });
      visualizerRef.current = visualizer;

      return () => {
        visualizer.cleanup();
      };
    }
  }, [showWaveform]);

  // Handle player events
  useEffect(() => {
    if (player.isPlaying) {
      onPlay?.();
      
      // Start visualization
      if (showWaveform && canvasRef.current && visualizerRef.current) {
        startVisualization();
      }
    } else {
      if (player.isPaused && !player.ended) {
        onPause?.();
      }
      stopVisualization();
    }
  }, [player.isPlaying, player.isPaused, onPlay, onPause, showWaveform]);

  useEffect(() => {
    if (player.ended) {
      onEnd?.();
      stopVisualization();
    }
  }, [player.ended, onEnd]);

  useEffect(() => {
    if (player.error || player.loadError) {
      onError?.(player.error || player.loadError);
    }
  }, [player.error, player.loadError, onError]);

  useEffect(() => {
    onTimeUpdate?.(player.currentTime, player.duration);
  }, [player.currentTime, player.duration, onTimeUpdate]);

  const startVisualization = async () => {
    if (!visualizerRef.current || !canvasRef.current) return;

    try {
      // Get the audio element from the player
      const audioPlayer = player.getPlayer();
      if (!audioPlayer) return;

      // We would need to modify the AudioPlaybackManager to expose the audio element
      // For now, we'll create a simple frequency visualization
      const theme_config = createVisualizationTheme(theme === 'dark' ? 'dark' : 'classic');
      
      visualizerRef.current.startVisualization((data) => {
        if (canvasRef.current) {
          visualizerRef.current!.renderFrequencyBars(canvasRef.current, theme_config);
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

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    player.seek(newTime);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    player.setVolume(newVolume);
  };

  const handlePlaybackRateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = parseFloat(event.target.value);
    player.setPlaybackRate(newRate);
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (!player.duration || player.duration === 0) return 0;
    return (player.currentTime / player.duration) * 100;
  };

  const getBufferedPercentage = (): number => {
    if (!player.buffered || !player.duration) return 0;
    
    let bufferedEnd = 0;
    for (let i = 0; i < player.buffered.length; i++) {
      if (player.buffered.start(i) <= player.currentTime && 
          player.buffered.end(i) > bufferedEnd) {
        bufferedEnd = player.buffered.end(i);
      }
    }
    
    return (bufferedEnd / player.duration) * 100;
  };

  const containerClasses = `
    p-4 rounded-lg border
    ${theme === 'dark' 
      ? 'bg-gray-900 border-gray-700 text-white' 
      : 'bg-white border-gray-300 text-gray-900'
    }
  `;

  const buttonClasses = `
    p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
    ${theme === 'dark'
      ? 'hover:bg-gray-700 text-white'
      : 'hover:bg-gray-100 text-gray-900'
    }
  `;

  const sliderClasses = `
    w-full h-2 rounded-lg appearance-none cursor-pointer
    ${theme === 'dark'
      ? 'bg-gray-700 [&::-webkit-slider-thumb]:bg-blue-500'
      : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-blue-600'
    }
  `;

  return (
    <div className={containerClasses}>
      <div className="space-y-4">
        {/* Waveform Visualization */}
        {showWaveform && (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={80}
              className={`w-full h-20 rounded border ${
                theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
              }`}
            />
            {!isVisualizationActive && player.isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-gray-500">
                  Starting visualization...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="relative">
            <div className={`w-full h-2 rounded-full overflow-hidden ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              {/* Buffered Progress */}
              <div
                className={`h-full absolute left-0 top-0 ${
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                }`}
                style={{ width: `${getBufferedPercentage()}%` }}
              />
              
              {/* Playback Progress */}
              <div
                className={`h-full absolute left-0 top-0 ${
                  theme === 'dark' ? 'bg-blue-500' : 'bg-blue-600'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            
            {/* Seek Slider */}
            <input
              type="range"
              min="0"
              max={player.duration || 0}
              step="0.1"
              value={player.currentTime}
              onChange={handleSeek}
              className={`absolute inset-0 w-full h-2 opacity-0 cursor-pointer ${sliderClasses}`}
              disabled={player.isLoading || !player.duration}
            />
          </div>
          
          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(player.currentTime)}</span>
            <span>{formatTime(player.duration)}</span>
          </div>
        </div>

        {showControls && (
          <>
            {/* Main Controls */}
            <div className="flex items-center justify-center space-x-2">
              {/* Previous/Rewind */}
              <button
                onClick={() => player.seek(Math.max(0, player.currentTime - 10))}
                className={buttonClasses}
                disabled={!player.duration}
                aria-label="Rewind 10 seconds"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 9H17a1 1 0 110 2h-5.586l4.293 4.293a1 1 0 010 1.414zM9 2a1 1 0 00-1 1v.586l-4.293-4.293a1 1 0 00-1.414 1.414L6.586 5H1a1 1 0 000 2h5.586l-4.293 4.293a1 1 0 101.414 1.414L8 8.414V9a1 1 0 002 0V3a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={player.isPlaying ? player.pause : player.play}
                className={`${buttonClasses} ${
                  theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                } text-white p-3`}
                disabled={player.isLoading || !src}
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isLoading ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : player.isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Next/Fast Forward */}
              <button
                onClick={() => player.seek(Math.min(player.duration, player.currentTime + 10))}
                className={buttonClasses}
                disabled={!player.duration}
                aria-label="Fast forward 10 seconds"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L8.586 11H3a1 1 0 110-2h5.586L4.293 5.707a1 1 0 010-1.414zM11 2a1 1 0 011 1v.586l4.293-4.293a1 1 0 111.414 1.414L13.414 5H19a1 1 0 110 2h-5.586l4.293 4.293a1 1 0 01-1.414 1.414L12 8.414V9a1 1 0 11-2 0V3a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Stop */}
              <button
                onClick={player.stop}
                className={buttonClasses}
                disabled={!player.isPlaying && !player.isPaused}
                aria-label="Stop"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center justify-between space-x-4">
              {/* Volume Control */}
              <div className="flex items-center space-x-2 flex-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.818L4.87 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.87l3.513-2.818a1 1 0 011.617.818zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={player.volume}
                  onChange={handleVolumeChange}
                  className={`flex-1 ${sliderClasses}`}
                  aria-label="Volume"
                />
                <span className="text-xs w-8 text-right">
                  {Math.round(player.volume * 100)}
                </span>
              </div>

              {/* Playback Speed */}
              <div className="flex items-center space-x-2">
                <span className="text-xs">Speed:</span>
                <select
                  value={player.playbackRate}
                  onChange={handlePlaybackRateChange}
                  className={`text-xs rounded px-2 py-1 ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Error Display */}
        {(player.error || player.loadError) && (
          <div className={`p-3 rounded border text-sm ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-200'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{(player.error || player.loadError)?.message}</span>
              <button
                onClick={player.clearError}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};