import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceControls } from '@/components/voice/VoiceControls';

// Mock all the voice hooks
vi.mock('@/hooks/useVoiceRecording', () => ({
  useVoiceRecording: vi.fn(),
  usePushToTalk: vi.fn(),
}));

vi.mock('@/hooks/useAudioPlayback', () => ({
  useAudioPlayback: vi.fn(),
}));

vi.mock('@/hooks/useVoiceActivity', () => ({
  useVoiceActivity: vi.fn(),
}));

const mockVoiceRecording = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  level: 0,
  error: null,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
  clearError: vi.fn(),
};

const mockPushToTalk = {
  isRecording: false,
  isPaused: false,
  isPressed: false,
  transcription: '',
  isTranscribing: false,
  transcriptionError: null,
  handlePressStart: vi.fn(),
  handlePressEnd: vi.fn(),
  clearTranscription: vi.fn(),
  ...mockVoiceRecording,
};

const mockVoiceActivity = {
  isListening: false,
  isSpeaking: false,
  audioLevel: 0,
  error: null,
  metrics: {
    totalSpeechTime: 0,
    totalSilenceTime: 0,
    speechSegments: 0,
  },
  startListening: vi.fn(),
  stopListening: vi.fn(),
  clearError: vi.fn(),
};

const mockAudioPlayback = {
  isPlaying: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  error: null,
  queue: [],
  playAudio: vi.fn(),
  pauseAudio: vi.fn(),
  stopAudio: vi.fn(),
  setVolume: vi.fn(),
  clearError: vi.fn(),
};

const { useVoiceRecording, usePushToTalk } = await import('@/hooks/useVoiceRecording');
const { useAudioPlayback } = await import('@/hooks/useAudioPlayback');
const { useVoiceActivity } = await import('@/hooks/useVoiceActivity');

vi.mocked(useVoiceRecording).mockReturnValue(mockVoiceRecording as any);
vi.mocked(usePushToTalk).mockReturnValue(mockPushToTalk as any);
vi.mocked(useAudioPlayback).mockReturnValue(mockAudioPlayback as any);
vi.mocked(useVoiceActivity).mockReturnValue(mockVoiceActivity as any);

describe('VoiceControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default manual mode', () => {
    render(<VoiceControls />);

    expect(screen.getByText('Recording Mode')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Push to Talk')).toBeInTheDocument();
    expect(screen.getByText('Auto Detect')).toBeInTheDocument();
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  it('should handle mode switching', () => {
    render(<VoiceControls />);

    const pushToTalkButton = screen.getByText('Push to Talk');
    fireEvent.click(pushToTalkButton);

    expect(screen.getByText('Hold to record or press Space')).toBeInTheDocument();

    const autoDetectButton = screen.getByText('Auto Detect');
    fireEvent.click(autoDetectButton);

    expect(screen.getByText('Start Auto Detection')).toBeInTheDocument();
  });

  it('should handle manual recording', async () => {
    mockVoiceRecording.stopRecording.mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' }));
    const onAudio = vi.fn();
    
    render(<VoiceControls onAudio={onAudio} />);

    const recordButton = screen.getByText('Start Recording');
    fireEvent.click(recordButton);

    expect(mockVoiceRecording.startRecording).toHaveBeenCalled();

    // Simulate recording state
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      isRecording: true,
      duration: 5000,
    } as any);

    const { rerender } = render(<VoiceControls onAudio={onAudio} />);
    
    const stopButton = screen.getByText('Stop Recording');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockVoiceRecording.stopRecording).toHaveBeenCalled();
    });
  });

  it('should handle push-to-talk mode', () => {
    render(<VoiceControls mode="push-to-talk" />);

    const pttButton = screen.getByRole('button', { name: /🎤/ });
    
    fireEvent.mouseDown(pttButton);
    expect(mockPushToTalk.handlePressStart).toHaveBeenCalled();

    fireEvent.mouseUp(pttButton);
    expect(mockPushToTalk.handlePressEnd).toHaveBeenCalled();
  });

  it('should handle touch events for push-to-talk', () => {
    render(<VoiceControls mode="push-to-talk" />);

    const pttButton = screen.getByRole('button', { name: /🎤/ });
    
    fireEvent.touchStart(pttButton);
    expect(mockPushToTalk.handlePressStart).toHaveBeenCalled();

    fireEvent.touchEnd(pttButton);
    expect(mockPushToTalk.handlePressEnd).toHaveBeenCalled();
  });

  it('should handle auto detection mode', () => {
    render(<VoiceControls mode="auto" />);

    const startButton = screen.getByText('Start Auto Detection');
    fireEvent.click(startButton);

    expect(mockVoiceActivity.startListening).toHaveBeenCalled();

    // Simulate listening state
    vi.mocked(useVoiceActivity).mockReturnValue({
      ...mockVoiceActivity,
      isListening: true,
    } as any);

    const { rerender } = render(<VoiceControls mode="auto" />);
    
    const stopButton = screen.getByText('Stop Listening');
    fireEvent.click(stopButton);

    expect(mockVoiceActivity.stopListening).toHaveBeenCalled();
  });

  it('should display audio level visualizer', () => {
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      level: 0.7,
    } as any);

    render(<VoiceControls showVisualizer={true} />);

    expect(screen.getByText('Audio Level')).toBeInTheDocument();
    
    const visualizer = screen.getByText('Audio Level').nextElementSibling?.querySelector('.bg-blue-500');
    expect(visualizer).toHaveStyle({ width: '70%' });
  });

  it('should hide visualizer when disabled', () => {
    render(<VoiceControls showVisualizer={false} />);

    expect(screen.queryByText('Audio Level')).not.toBeInTheDocument();
  });

  it('should display recording duration', () => {
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      isRecording: true,
      duration: 125000, // 2:05
    } as any);

    render(<VoiceControls />);

    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should handle pause and resume in manual mode', () => {
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      isRecording: true,
      isPaused: false,
    } as any);

    render(<VoiceControls />);

    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

    expect(mockVoiceRecording.pauseRecording).toHaveBeenCalled();

    // Simulate paused state
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      isRecording: true,
      isPaused: true,
    } as any);

    const { rerender } = render(<VoiceControls />);
    
    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);

    expect(mockVoiceRecording.resumeRecording).toHaveBeenCalled();
  });

  it('should display error messages', () => {
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      error: new Error('Microphone access denied'),
    } as any);

    render(<VoiceControls />);

    expect(screen.getByText('Recording Error')).toBeInTheDocument();
    expect(screen.getByText('Microphone access denied')).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /×/ });
    fireEvent.click(dismissButton);

    expect(mockVoiceRecording.clearError).toHaveBeenCalled();
  });

  it('should display transcription in push-to-talk mode', () => {
    vi.mocked(usePushToTalk).mockReturnValue({
      ...mockPushToTalk,
      transcription: 'Hello, this is a test transcription.',
    } as any);

    render(<VoiceControls mode="push-to-talk" />);

    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.getByText('Hello, this is a test transcription.')).toBeInTheDocument();

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(mockPushToTalk.clearTranscription).toHaveBeenCalled();
  });

  it('should show transcribing state', () => {
    vi.mocked(usePushToTalk).mockReturnValue({
      ...mockPushToTalk,
      isTranscribing: true,
    } as any);

    render(<VoiceControls mode="push-to-talk" />);

    expect(screen.getByText('Transcribing...')).toBeInTheDocument();
  });

  it('should display voice activity metrics', () => {
    vi.mocked(useVoiceActivity).mockReturnValue({
      ...mockVoiceActivity,
      isListening: true,
      metrics: {
        totalSpeechTime: 15000,
        totalSilenceTime: 8000,
        speechSegments: 3,
      },
    } as any);

    render(<VoiceControls mode="auto" />);

    expect(screen.getByText('Speech Time')).toBeInTheDocument();
    expect(screen.getByText('15s')).toBeInTheDocument();
    expect(screen.getByText('Silence Time')).toBeInTheDocument();
    expect(screen.getByText('8s')).toBeInTheDocument();
    expect(screen.getByText('Segments')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show speech detection indicator', () => {
    vi.mocked(useVoiceActivity).mockReturnValue({
      ...mockVoiceActivity,
      isListening: true,
      isSpeaking: true,
    } as any);

    render(<VoiceControls mode="auto" />);

    expect(screen.getByText('Speech detected')).toBeInTheDocument();

    // Check for the red pulsing indicator
    const indicator = screen.getByText('Speech detected').previousElementSibling;
    expect(indicator).toHaveClass('bg-red-500', 'animate-pulse');
  });

  it('should disable controls when disabled prop is true', () => {
    render(<VoiceControls disabled={true} />);

    const recordButton = screen.getByText('Start Recording');
    expect(recordButton).toBeDisabled();

    const modeButtons = screen.getAllByRole('button').filter(btn => 
      btn.textContent === 'Manual' || btn.textContent === 'Push to Talk' || btn.textContent === 'Auto Detect'
    );
    
    modeButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should call onTranscription callback', () => {
    const onTranscription = vi.fn();
    
    render(<VoiceControls onTranscription={onTranscription} mode="push-to-talk" />);

    // The callback should be passed to usePushToTalk
    expect(vi.mocked(usePushToTalk)).toHaveBeenCalledWith({
      onTranscription,
      onAudio: undefined,
    });
  });

  it('should call onAudio callback', () => {
    const onAudio = vi.fn();
    
    render(<VoiceControls onAudio={onAudio} mode="push-to-talk" />);

    // The callback should be passed to usePushToTalk
    expect(vi.mocked(usePushToTalk)).toHaveBeenCalledWith({
      onTranscription: undefined,
      onAudio,
    });
  });

  it('should stop recordings when switching modes', () => {
    vi.mocked(useVoiceRecording).mockReturnValue({
      ...mockVoiceRecording,
      isRecording: true,
    } as any);

    render(<VoiceControls />);

    const pushToTalkButton = screen.getByText('Push to Talk');
    fireEvent.click(pushToTalkButton);

    expect(mockVoiceRecording.stopRecording).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(<VoiceControls className="custom-class" />);

    const voiceControls = container.querySelector('.voice-controls');
    expect(voiceControls).toHaveClass('custom-class');
  });
});
