// Voice component exports
export { VoiceRecorder } from './VoiceRecorder';
export { AudioPlayer } from './AudioPlayer';
export { VoiceButton } from './VoiceButton';

// Re-export types for convenience
export type { 
  VoiceRecorderProps, 
  AudioPlayerProps, 
  VoiceButtonProps 
} from '../../lib/audio/types';

// Default export for convenience
export default {
  VoiceRecorder,
  AudioPlayer,
  VoiceButton,
};