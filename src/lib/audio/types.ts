// Audio recording types
export interface AudioRecorderConfig {
  sampleRate?: number;
  channels?: number;
  format?: AudioFormat;
  bufferSize?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export enum AudioFormat {
  WAV = 'wav',
  MP3 = 'mp3',
  OGG = 'ogg',
  WEBM = 'webm',
  M4A = 'm4a',
}

export interface AudioRecordingResult {
  blob: Blob;
  duration: number;
  sampleRate: number;
  channels: number;
  format: AudioFormat;
}

// Voice activity detection types
export interface VADConfig {
  threshold?: number;
  minSilenceDuration?: number;
  maxSilenceDuration?: number;
  preSpeechPadding?: number;
  postSpeechPadding?: number;
}

export interface VADResult {
  isSpeechActive: boolean;
  confidence: number;
  silenceDuration: number;
  speechDuration: number;
}

// Text-to-speech types
export enum TTSVoice {
  ALLOY = 'alloy',
  ECHO = 'echo',
  FABLE = 'fable',
  ONYX = 'onyx',
  NOVA = 'nova',
  SHIMMER = 'shimmer',
}

export enum TTSSpeed {
  SLOW = 0.25,
  NORMAL = 1.0,
  FAST = 1.75,
}

export interface TTSOptions {
  voice?: TTSVoice;
  speed?: TTSSpeed;
  model?: 'tts-1' | 'tts-1-hd';
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
  ssml?: boolean;
  optimize?: 'conversation' | 'podcast' | 'narration';
  cache?: boolean;
  cacheDuration?: number;
}

// Speech-to-text types
export interface WhisperOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  model?: 'whisper-1';
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  compress?: boolean;
  enhance?: boolean;
  includeSegments?: boolean;
  cache?: boolean;
}

export interface WhisperResult {
  text: string;
  language: string;
  duration: number;
  segments?: WhisperSegment[];
}

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

// Audio playback types
export interface AudioPlaybackConfig {
  volume?: number;
  playbackRate?: number;
  autoPlay?: boolean;
  loop?: boolean;
  crossOrigin?: string;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  buffered: TimeRanges | null;
  ended: boolean;
}

// Audio visualization types
export interface AudioVisualizationConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
  refreshRate?: number;
}

export interface FrequencyBands {
  low: number;
  mid: number;
  high: number;
}

export interface AudioPeaks {
  positive: number;
  negative: number;
}

export interface VisualizationOptions {
  throttle?: number;
  resolution?: number;
  colorScheme?: 'default' | 'neon' | 'classic';
}

// Audio processing types
export interface AudioProcessingOptions {
  normalize?: boolean;
  denoise?: boolean;
  compress?: boolean;
  enhanceVoice?: boolean;
  targetBitrate?: number;
}

export interface AudioAnalysisResult {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  format: string;
  loudness: number;
  dynamicRange: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
}

// Error types
export class AudioError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AudioError';
  }
}

export class RecordingError extends AudioError {
  constructor(message: string) {
    super(message, 'RECORDING_ERROR');
  }
}

export class PlaybackError extends AudioError {
  constructor(message: string) {
    super(message, 'PLAYBACK_ERROR');
  }
}

export class TranscriptionError extends AudioError {
  constructor(message: string) {
    super(message, 'TRANSCRIPTION_ERROR');
  }
}

export class SynthesisError extends AudioError {
  constructor(message: string) {
    super(message, 'SYNTHESIS_ERROR');
  }
}

// Browser compatibility types
export interface BrowserAudioSupport {
  webAudio: boolean;
  mediaRecorder: boolean;
  mediaStream: boolean;
  audioContext: boolean;
  getUserMedia: boolean;
  supportedFormats: AudioFormat[];
}

// Event types
export interface AudioEvent {
  type: string;
  timestamp: number;
  data?: any;
}

export interface RecordingEvent extends AudioEvent {
  type: 'recording_started' | 'recording_stopped' | 'recording_paused' | 'recording_resumed' | 'recording_error';
  duration?: number;
  level?: number;
}

export interface PlaybackEvent extends AudioEvent {
  type: 'playback_started' | 'playback_stopped' | 'playback_paused' | 'playback_resumed' | 'playback_ended' | 'playback_error' | 'playback_loading' | 'playback_ready' | 'playback_timeupdate' | 'playback_volumechange' | 'playback_ratechange';
  currentTime?: number;
  duration?: number;
}

export interface VisualizationEvent extends AudioEvent {
  type: 'visualization_started' | 'visualization_stopped' | 'level_changed' | 'peak_detected';
  level?: number;
  frequencies?: Uint8Array;
  waveform?: Uint8Array;
}

// Utility types
export type AudioEventListener<T extends AudioEvent> = (event: T) => void;

export interface AudioEventEmitter {
  on<T extends AudioEvent>(event: string, listener: AudioEventListener<T>): void;
  off<T extends AudioEvent>(event: string, listener: AudioEventListener<T>): void;
  emit<T extends AudioEvent>(event: string, data: T): void;
}

// Component props types
export interface VoiceRecorderProps {
  onRecordingStart?: () => void;
  onRecordingStop?: (audio: Blob) => void;
  onRecordingPause?: () => void;
  onRecordingResume?: () => void;
  onError?: (error: AudioError) => void;
  onLevelChange?: (level: number) => void;
  maxDuration?: number;
  autoStop?: boolean;
  enableVAD?: boolean;
  showWaveform?: boolean;
  theme?: 'light' | 'dark';
  disabled?: boolean;
}

export interface AudioPlayerProps {
  src?: string | Blob;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: AudioError) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  showControls?: boolean;
  showWaveform?: boolean;
  theme?: 'light' | 'dark';
}

export interface VoiceButtonProps {
  onPress?: () => void;
  onRelease?: () => void;
  onTranscription?: (text: string) => void;
  onError?: (error: AudioError) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
  theme?: 'light' | 'dark';
  pushToTalk?: boolean;
  showLevel?: boolean;
}

// Hook return types
export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  level: number;
  error: AudioError | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearError: () => void;
}

export interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  buffered: TimeRanges | null;
  ended: boolean;
  error: AudioError | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  clearError: () => void;
}

export interface UseVoiceActivityReturn {
  isSpeechActive: boolean;
  confidence: number;
  silenceDuration: number;
  speechDuration: number;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  configure: (config: VADConfig) => void;
}