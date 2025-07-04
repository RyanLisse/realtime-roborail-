import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AudioPlaybackManager, 
  AudioPlaybackConfig, 
  PlaybackError, 
  UseAudioPlaybackReturn 
} from '../lib/audio';

export function useAudioPlayback(config?: AudioPlaybackConfig): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(config?.volume || 1.0);
  const [playbackRate, setPlaybackRateState] = useState(config?.playbackRate || 1.0);
  const [buffered, setBuffered] = useState<TimeRanges | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<PlaybackError | null>(null);
  
  const playerRef = useRef<AudioPlaybackManager | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  // Initialize player
  useEffect(() => {
    try {
      playerRef.current = new AudioPlaybackManager(config);
      
      // Set up event listeners
      playerRef.current.on('playback_started', () => {
        setIsPlaying(true);
        setIsPaused(false);
        setEnded(false);
        startTimeTracking();
      });
      
      playerRef.current.on('playback_paused', () => {
        setIsPlaying(false);
        setIsPaused(true);
        stopTimeTracking();
      });
      
      playerRef.current.on('playback_ended', () => {
        setIsPlaying(false);
        setIsPaused(false);
        setEnded(true);
        stopTimeTracking();
      });
      
      playerRef.current.on('playback_error', (event) => {
        setError(new PlaybackError(`Playback error: ${event.data?.message || 'Unknown error'}`));
        setIsPlaying(false);
        stopTimeTracking();
      });
      
      playerRef.current.on('playback_ready', (event) => {
        setDuration(event.duration || 0);
        setError(null);
      });
      
      playerRef.current.on('playback_volumechange', (event) => {
        setVolumeState(event.data?.volume || 1.0);
      });
      
      playerRef.current.on('playback_ratechange', (event) => {
        setPlaybackRateState(event.data?.playbackRate || 1.0);
      });
      
    } catch (err) {
      setError(new PlaybackError(`Failed to initialize player: ${err.message}`));
    }

    return () => {
      stopTimeTracking();
      if (playerRef.current) {
        playerRef.current.cleanup();
      }
    };
  }, [config]);

  const startTimeTracking = useCallback(() => {
    if (timeUpdateIntervalRef.current) return;
    
    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (playerRef.current) {
        const state = playerRef.current.getState();
        setCurrentTime(state.currentTime);
        setBuffered(state.buffered);
      }
    }, 100);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  const play = useCallback(async (): Promise<void> => {
    if (!playerRef.current) {
      setError(new PlaybackError('Player not initialized'));
      return;
    }

    try {
      setError(null);
      await playerRef.current.play();
    } catch (err) {
      setError(new PlaybackError(`Failed to play: ${err.message}`));
    }
  }, []);

  const pause = useCallback((): void => {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.pause();
    } catch (err) {
      setError(new PlaybackError(`Failed to pause: ${err.message}`));
    }
  }, []);

  const stop = useCallback((): void => {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.stop();
      setCurrentTime(0);
      setEnded(false);
    } catch (err) {
      setError(new PlaybackError(`Failed to stop: ${err.message}`));
    }
  }, []);

  const seek = useCallback((time: number): void => {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.seek(time);
      setCurrentTime(time);
    } catch (err) {
      setError(new PlaybackError(`Failed to seek: ${err.message}`));
    }
  }, []);

  const setVolume = useCallback((newVolume: number): void => {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.setVolume(newVolume);
    } catch (err) {
      setError(new PlaybackError(`Failed to set volume: ${err.message}`));
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number): void => {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.setPlaybackRate(rate);
    } catch (err) {
      setError(new PlaybackError(`Failed to set playback rate: ${err.message}`));
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Expose player for advanced usage
  const getPlayer = useCallback((): AudioPlaybackManager | null => {
    return playerRef.current;
  }, []);

  return {
    isPlaying,
    isPaused,
    currentTime,
    duration,
    volume,
    playbackRate,
    buffered,
    ended,
    error,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPlaybackRate,
    clearError,
    getPlayer,
  };
}

// Hook for loading and playing audio
export function useAudioPlayer(src?: string | Blob, config?: AudioPlaybackConfig) {
  const playback = useAudioPlayback(config);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const loadAudio = useCallback(async (audioSrc: string | Blob): Promise<void> => {
    const player = playback.getPlayer();
    if (!player) {
      setLoadError(new Error('Player not initialized'));
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      await player.loadAudio(audioSrc);
    } catch (err) {
      setLoadError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [playback]);

  const playAudio = useCallback(async (audioSrc?: string | Blob): Promise<void> => {
    if (audioSrc) {
      await loadAudio(audioSrc);
    }
    await playback.play();
  }, [loadAudio, playback]);

  // Auto-load if src is provided
  useEffect(() => {
    if (src) {
      loadAudio(src);
    }
  }, [src, loadAudio]);

  return {
    ...playback,
    isLoading,
    loadError,
    loadAudio,
    playAudio,
  };
}

// Hook for text-to-speech playback
export function useTextToSpeech(config?: {
  playback?: AudioPlaybackConfig;
  tts?: {
    voice?: string;
    speed?: number;
    model?: 'tts-1' | 'tts-1-hd';
  };
}) {
  const playback = useAudioPlayback(config?.playback);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<Error | null>(null);
  const [currentText, setCurrentText] = useState('');

  const speak = useCallback(async (text: string): Promise<void> => {
    setIsSynthesizing(true);
    setSynthesisError(null);
    setCurrentText(text);

    try {
      const { synthesizeSpeech } = await import('../lib/audio');
      const audioBlob = await synthesizeSpeech(text, config?.tts);
      
      const player = playback.getPlayer();
      if (player) {
        await player.loadAudio(audioBlob);
        await player.play();
      }
    } catch (err) {
      setSynthesisError(err as Error);
    } finally {
      setIsSynthesizing(false);
    }
  }, [playback, config?.tts]);

  const stopSpeaking = useCallback(() => {
    playback.stop();
    setCurrentText('');
  }, [playback]);

  return {
    ...playback,
    isSynthesizing,
    synthesisError,
    currentText,
    speak,
    stopSpeaking,
  };
}

// Hook for audio playlist management
export function useAudioPlaylist(config?: AudioPlaybackConfig) {
  const [playlist, setPlaylist] = useState<(string | Blob)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  
  const playback = useAudioPlayback(config);
  const playlistRef = useRef<any>(null);

  useEffect(() => {
    const initPlaylist = async () => {
      const { AudioPlaylist } = await import('../lib/audio');
      playlistRef.current = new AudioPlaylist(config);
      
      // Sync playlist events with hook state
      playlistRef.current.getPlayer().on('playback_ended', () => {
        if (repeatMode === 'one') {
          // Replay current track
          playlistRef.current?.playTrack(currentIndex);
        } else {
          // Auto-advance to next track
          next();
        }
      });
    };

    initPlaylist();

    return () => {
      if (playlistRef.current) {
        playlistRef.current.cleanup();
      }
    };
  }, [config, repeatMode, currentIndex]);

  const addTrack = useCallback((src: string | Blob) => {
    if (playlistRef.current) {
      playlistRef.current.addTrack(src);
      setPlaylist(prev => [...prev, src]);
    }
  }, []);

  const addTracks = useCallback((sources: (string | Blob)[]) => {
    if (playlistRef.current) {
      playlistRef.current.addTracks(sources);
      setPlaylist(prev => [...prev, ...sources]);
    }
  }, []);

  const removeTrack = useCallback((index: number) => {
    if (playlistRef.current) {
      playlistRef.current.removeTrack(index);
      setPlaylist(prev => prev.filter((_, i) => i !== index));
      
      if (index === currentIndex) {
        setCurrentIndex(-1);
      } else if (index < currentIndex) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  }, [currentIndex]);

  const playTrack = useCallback(async (index: number) => {
    if (playlistRef.current && index >= 0 && index < playlist.length) {
      await playlistRef.current.playTrack(index);
      setCurrentIndex(index);
    }
  }, [playlist.length]);

  const play = useCallback(async () => {
    if (playlistRef.current) {
      await playlistRef.current.play();
      if (currentIndex === -1 && playlist.length > 0) {
        setCurrentIndex(0);
      }
    }
  }, [currentIndex, playlist.length]);

  const pause = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.pause();
    }
  }, []);

  const stop = useCallback(() => {
    if (playlistRef.current) {
      playlistRef.current.stop();
      setCurrentIndex(-1);
    }
  }, []);

  const next = useCallback(async () => {
    if (playlistRef.current) {
      await playlistRef.current.next();
      const newIndex = playlistRef.current.getCurrentTrackIndex();
      setCurrentIndex(newIndex);
    }
  }, []);

  const previous = useCallback(async () => {
    if (playlistRef.current) {
      await playlistRef.current.previous();
      const newIndex = playlistRef.current.getCurrentTrackIndex();
      setCurrentIndex(newIndex);
    }
  }, []);

  const setShuffle = useCallback((enabled: boolean) => {
    if (playlistRef.current) {
      playlistRef.current.setShuffle(enabled);
      setShuffleEnabled(enabled);
    }
  }, []);

  const setRepeat = useCallback((mode: 'none' | 'one' | 'all') => {
    if (playlistRef.current) {
      playlistRef.current.setRepeatMode(mode);
      setRepeatMode(mode);
    }
  }, []);

  const clearPlaylist = useCallback(() => {
    stop();
    setPlaylist([]);
    setCurrentIndex(-1);
  }, [stop]);

  return {
    playlist,
    currentIndex,
    shuffleEnabled,
    repeatMode,
    addTrack,
    addTracks,
    removeTrack,
    playTrack,
    play,
    pause,
    stop,
    next,
    previous,
    setShuffle,
    setRepeat,
    clearPlaylist,
    // Include all playback controls
    ...playback,
  };
}