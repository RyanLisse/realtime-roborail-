import { 
  AudioPlaybackConfig, 
  AudioPlaybackState, 
  PlaybackError,
  PlaybackEvent,
  AudioEventEmitter,
  AudioEventListener 
} from './types';

export class AudioPlaybackManager implements AudioEventEmitter {
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eventListeners: Map<string, AudioEventListener<any>[]> = new Map();
  private currentSrc: string | Blob | null = null;
  private objectURL: string | null = null;
  
  private config: Required<AudioPlaybackConfig> = {
    volume: 1.0,
    playbackRate: 1.0,
    autoPlay: false,
    loop: false,
    crossOrigin: 'anonymous',
  };

  constructor(config?: AudioPlaybackConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.initializeAudio();
  }

  private initializeAudio(): void {
    try {
      this.audioElement = new Audio();
      this.setupAudioElement();
      
      // Initialize Web Audio context for advanced control
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioContext();
      
    } catch (error) {
      throw new PlaybackError(`Failed to initialize audio: ${error.message}`);
    }
  }

  private setupAudioElement(): void {
    if (!this.audioElement) return;
    
    this.audioElement.volume = this.config.volume;
    this.audioElement.playbackRate = this.config.playbackRate;
    this.audioElement.loop = this.config.loop;
    this.audioElement.crossOrigin = this.config.crossOrigin;
    this.audioElement.preload = 'auto';
    
    // Event listeners
    this.audioElement.addEventListener('loadstart', () => {
      this.emit('playback_loading', {
        type: 'playback_loading',
        timestamp: Date.now(),
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('canplay', () => {
      this.emit('playback_ready', {
        type: 'playback_ready',
        timestamp: Date.now(),
        duration: this.audioElement!.duration,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('play', () => {
      this.emit('playback_started', {
        type: 'playback_started',
        timestamp: Date.now(),
        currentTime: this.audioElement!.currentTime,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('pause', () => {
      this.emit('playback_paused', {
        type: 'playback_paused',
        timestamp: Date.now(),
        currentTime: this.audioElement!.currentTime,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('ended', () => {
      this.emit('playback_ended', {
        type: 'playback_ended',
        timestamp: Date.now(),
        duration: this.audioElement!.duration,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('timeupdate', () => {
      this.emit('playback_timeupdate', {
        type: 'playback_timeupdate',
        timestamp: Date.now(),
        currentTime: this.audioElement!.currentTime,
        duration: this.audioElement!.duration,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('error', (event) => {
      const error = this.audioElement!.error;
      this.emit('playback_error', {
        type: 'playback_error',
        timestamp: Date.now(),
        data: error,
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('volumechange', () => {
      this.emit('playback_volumechange', {
        type: 'playback_volumechange',
        timestamp: Date.now(),
        data: { volume: this.audioElement!.volume },
      } as PlaybackEvent);
    });
    
    this.audioElement.addEventListener('ratechange', () => {
      this.emit('playback_ratechange', {
        type: 'playback_ratechange',
        timestamp: Date.now(),
        data: { playbackRate: this.audioElement!.playbackRate },
      } as PlaybackEvent);
    });
  }

  private setupAudioContext(): void {
    if (!this.audioContext || !this.audioElement) return;
    
    try {
      // Create audio nodes
      const source = this.audioContext.createMediaElementSource(this.audioElement);
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect nodes
      source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      // Sync gain with audio element volume
      this.gainNode.gain.value = this.config.volume;
      
    } catch (error) {
      console.warn('Web Audio API setup failed:', error);
    }
  }

  public async loadAudio(src: string | Blob): Promise<void> {
    if (!this.audioElement) {
      throw new PlaybackError('Audio element not initialized');
    }
    
    try {
      // Clean up previous source
      this.cleanupCurrentSource();
      
      if (src instanceof Blob) {
        this.objectURL = URL.createObjectURL(src);
        this.audioElement.src = this.objectURL;
      } else {
        this.audioElement.src = src;
      }
      
      this.currentSrc = src;
      
      // Wait for the audio to be ready
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          this.audioElement!.removeEventListener('canplay', onCanPlay);
          this.audioElement!.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = () => {
          this.audioElement!.removeEventListener('canplay', onCanPlay);
          this.audioElement!.removeEventListener('error', onError);
          reject(new PlaybackError('Failed to load audio'));
        };
        
        this.audioElement!.addEventListener('canplay', onCanPlay);
        this.audioElement!.addEventListener('error', onError);
        
        this.audioElement!.load();
      });
      
    } catch (error) {
      throw new PlaybackError(`Failed to load audio: ${error.message}`);
    }
  }

  public async play(): Promise<void> {
    if (!this.audioElement) {
      throw new PlaybackError('Audio element not initialized');
    }
    
    try {
      // Resume audio context if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      await this.audioElement.play();
    } catch (error) {
      throw new PlaybackError(`Failed to play audio: ${error.message}`);
    }
  }

  public pause(): void {
    if (!this.audioElement) {
      throw new PlaybackError('Audio element not initialized');
    }
    
    this.audioElement.pause();
  }

  public stop(): void {
    if (!this.audioElement) {
      throw new PlaybackError('Audio element not initialized');
    }
    
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  public seek(time: number): void {
    if (!this.audioElement) {
      throw new PlaybackError('Audio element not initialized');
    }
    
    if (time < 0 || time > this.audioElement.duration) {
      throw new PlaybackError('Seek time out of bounds');
    }
    
    this.audioElement.currentTime = time;
  }

  public setVolume(volume: number): void {
    if (volume < 0 || volume > 1) {
      throw new PlaybackError('Volume must be between 0 and 1');
    }
    
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
    
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
    
    this.config.volume = volume;
  }

  public setPlaybackRate(rate: number): void {
    if (rate <= 0 || rate > 4) {
      throw new PlaybackError('Playback rate must be between 0 and 4');
    }
    
    if (this.audioElement) {
      this.audioElement.playbackRate = rate;
    }
    
    this.config.playbackRate = rate;
  }

  public setLoop(loop: boolean): void {
    if (this.audioElement) {
      this.audioElement.loop = loop;
    }
    
    this.config.loop = loop;
  }

  public getState(): AudioPlaybackState {
    if (!this.audioElement) {
      return {
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: 0,
        volume: 0,
        playbackRate: 1,
        buffered: null,
        ended: false,
      };
    }
    
    return {
      isPlaying: !this.audioElement.paused && !this.audioElement.ended,
      isPaused: this.audioElement.paused && this.audioElement.currentTime > 0,
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration || 0,
      volume: this.audioElement.volume,
      playbackRate: this.audioElement.playbackRate,
      buffered: this.audioElement.buffered,
      ended: this.audioElement.ended,
    };
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array();
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return dataArray;
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array();
    
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    
    return dataArray;
  }

  public getRMSLevel(): number {
    const waveform = this.getWaveformData();
    if (waveform.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < waveform.length; i++) {
      const sample = (waveform[i] - 128) / 128;
      sum += sample * sample;
    }
    
    return Math.sqrt(sum / waveform.length);
  }

  public async fadeIn(duration: number = 1000): Promise<void> {
    if (!this.gainNode) {
      throw new PlaybackError('Web Audio context not available');
    }
    
    const currentTime = this.audioContext!.currentTime;
    this.gainNode.gain.cancelScheduledValues(currentTime);
    this.gainNode.gain.setValueAtTime(0, currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.config.volume, currentTime + duration / 1000);
    
    await this.play();
  }

  public async fadeOut(duration: number = 1000): Promise<void> {
    if (!this.gainNode) {
      throw new PlaybackError('Web Audio context not available');
    }
    
    const currentTime = this.audioContext!.currentTime;
    this.gainNode.gain.cancelScheduledValues(currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, currentTime + duration / 1000);
    
    // Stop playback after fade completes
    setTimeout(() => {
      this.stop();
      if (this.gainNode) {
        this.gainNode.gain.setValueAtTime(this.config.volume, this.audioContext!.currentTime);
      }
    }, duration);
  }

  public async crossfade(
    newSrc: string | Blob, 
    duration: number = 1000
  ): Promise<void> {
    // Create a second audio manager for crossfading
    const newPlayer = new AudioPlaybackManager(this.config);
    await newPlayer.loadAudio(newSrc);
    
    // Start fade out of current audio
    const fadeOutPromise = this.fadeOut(duration);
    
    // Start fade in of new audio
    const fadeInPromise = newPlayer.fadeIn(duration);
    
    await Promise.all([fadeOutPromise, fadeInPromise]);
    
    // Replace current player with new one
    this.cleanup();
    this.audioElement = newPlayer.audioElement;
    this.audioContext = newPlayer.audioContext;
    this.gainNode = newPlayer.gainNode;
    this.analyser = newPlayer.analyser;
    this.currentSrc = newSrc;
  }

  private cleanupCurrentSource(): void {
    if (this.objectURL) {
      URL.revokeObjectURL(this.objectURL);
      this.objectURL = null;
    }
  }

  public cleanup(): void {
    this.stop();
    this.cleanupCurrentSource();
    
    if (this.audioElement) {
      this.audioElement.removeAttribute('src');
      this.audioElement.load(); // Reset the element
      this.audioElement = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.gainNode = null;
    this.analyser = null;
    this.currentSrc = null;
    this.eventListeners.clear();
  }

  // Event emitter implementation
  public on<T extends PlaybackEvent>(event: string, listener: AudioEventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  public off<T extends PlaybackEvent>(event: string, listener: AudioEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  public emit<T extends PlaybackEvent>(event: string, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}

// Playlist manager for sequential playback
export class AudioPlaylist {
  private player: AudioPlaybackManager;
  private playlist: (string | Blob)[] = [];
  private currentIndex: number = -1;
  private isPlaying: boolean = false;
  private shuffleEnabled: boolean = false;
  private repeatMode: 'none' | 'one' | 'all' = 'none';

  constructor(config?: AudioPlaybackConfig) {
    this.player = new AudioPlaybackManager(config);
    
    this.player.on('playback_ended', () => {
      this.handleTrackEnd();
    });
  }

  public addTrack(src: string | Blob): void {
    this.playlist.push(src);
  }

  public addTracks(sources: (string | Blob)[]): void {
    this.playlist.push(...sources);
  }

  public removeTrack(index: number): void {
    if (index >= 0 && index < this.playlist.length) {
      this.playlist.splice(index, 1);
      
      if (index === this.currentIndex) {
        this.stop();
      } else if (index < this.currentIndex) {
        this.currentIndex--;
      }
    }
  }

  public async playTrack(index: number): Promise<void> {
    if (index < 0 || index >= this.playlist.length) {
      throw new PlaybackError('Track index out of bounds');
    }
    
    this.currentIndex = index;
    await this.player.loadAudio(this.playlist[index]);
    await this.player.play();
    this.isPlaying = true;
  }

  public async play(): Promise<void> {
    if (this.playlist.length === 0) {
      throw new PlaybackError('Playlist is empty');
    }
    
    if (this.currentIndex === -1) {
      await this.playTrack(0);
    } else {
      await this.player.play();
      this.isPlaying = true;
    }
  }

  public pause(): void {
    this.player.pause();
    this.isPlaying = false;
  }

  public stop(): void {
    this.player.stop();
    this.isPlaying = false;
    this.currentIndex = -1;
  }

  public async next(): Promise<void> {
    const nextIndex = this.getNextTrackIndex();
    if (nextIndex !== -1) {
      await this.playTrack(nextIndex);
    }
  }

  public async previous(): Promise<void> {
    const prevIndex = this.getPreviousTrackIndex();
    if (prevIndex !== -1) {
      await this.playTrack(prevIndex);
    }
  }

  public setShuffle(enabled: boolean): void {
    this.shuffleEnabled = enabled;
  }

  public setRepeatMode(mode: 'none' | 'one' | 'all'): void {
    this.repeatMode = mode;
  }

  public getPlaylist(): (string | Blob)[] {
    return [...this.playlist];
  }

  public getCurrentTrackIndex(): number {
    return this.currentIndex;
  }

  public getPlayer(): AudioPlaybackManager {
    return this.player;
  }

  private async handleTrackEnd(): Promise<void> {
    if (this.repeatMode === 'one') {
      await this.playTrack(this.currentIndex);
    } else {
      const nextIndex = this.getNextTrackIndex();
      if (nextIndex !== -1) {
        await this.playTrack(nextIndex);
      } else {
        this.isPlaying = false;
      }
    }
  }

  private getNextTrackIndex(): number {
    if (this.playlist.length === 0) return -1;
    
    if (this.shuffleEnabled) {
      const availableIndices = this.playlist.map((_, i) => i).filter(i => i !== this.currentIndex);
      if (availableIndices.length === 0) {
        return this.repeatMode === 'all' ? Math.floor(Math.random() * this.playlist.length) : -1;
      }
      return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }
    
    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.playlist.length) {
      return this.repeatMode === 'all' ? 0 : -1;
    }
    
    return nextIndex;
  }

  private getPreviousTrackIndex(): number {
    if (this.playlist.length === 0) return -1;
    
    if (this.shuffleEnabled) {
      return Math.floor(Math.random() * this.playlist.length);
    }
    
    const prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      return this.repeatMode === 'all' ? this.playlist.length - 1 : -1;
    }
    
    return prevIndex;
  }

  public cleanup(): void {
    this.stop();
    this.player.cleanup();
    this.playlist = [];
  }
}

// Utility functions
export function createAudioPlayer(config?: AudioPlaybackConfig): AudioPlaybackManager {
  return new AudioPlaybackManager(config);
}

export function createAudioPlaylist(config?: AudioPlaybackConfig): AudioPlaylist {
  return new AudioPlaylist(config);
}

export async function playAudio(src: string | Blob, config?: AudioPlaybackConfig): Promise<AudioPlaybackManager> {
  const player = new AudioPlaybackManager(config);
  await player.loadAudio(src);
  await player.play();
  return player;
}

export function getAudioDuration(src: string | Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', () => {
      reject(new PlaybackError('Failed to get audio duration'));
    });
    
    if (src instanceof Blob) {
      const objectURL = URL.createObjectURL(src);
      audio.src = objectURL;
      audio.load();
      // Clean up after getting duration
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(objectURL);
      });
    } else {
      audio.src = src;
      audio.load();
    }
  });
}