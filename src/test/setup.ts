import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
vi.stubEnv('VECTOR_STORE_ID', 'test-vector-store-id');
vi.stubEnv('AUTH_SECRET', 'test-auth-secret-for-testing-purposes-only');

// Mock fetch globally
Object.defineProperty(window, 'fetch', {
  value: vi.fn(),
  configurable: true,
});

// Mock URL constructor and static methods
Object.defineProperty(global, 'URL', {
  value: class MockURL {
    href: string;
    origin: string;
    protocol: string;
    hostname: string;
    host: string;
    pathname: string;
    search: string;
    hash: string;
    port: string;

    constructor(url: string, base?: string) {
      // Parse the URL string to extract components
      const urlObj = this.parseURL(url, base);
      this.href = urlObj.href;
      this.origin = urlObj.origin;
      this.protocol = urlObj.protocol;
      this.hostname = urlObj.hostname;
      this.host = urlObj.host;
      this.pathname = urlObj.pathname;
      this.search = urlObj.search;
      this.hash = urlObj.hash;
      this.port = urlObj.port;
    }

    private parseURL(url: string, base?: string) {
      // Simple URL parsing for test purposes
      if (!url.includes('://')) {
        throw new TypeError('Invalid URL');
      }
      
      const [protocol, rest] = url.split('://');
      const [hostPart, ...pathParts] = rest.split('/');
      const [hostname, port = ''] = hostPart.split(':');
      const pathname = '/' + pathParts.join('/');
      
      const host = port ? `${hostname}:${port}` : hostname;
      const origin = `${protocol}://${host}`;
      
      return {
        href: url,
        origin,
        protocol: protocol + ':',
        hostname,
        host,
        pathname,
        search: '',
        hash: '',
        port
      };
    }

    static createObjectURL = vi.fn(() => 'blob:mock-url');
    static revokeObjectURL = vi.fn();
  },
  configurable: true,
});

// Mock File.prototype.arrayBuffer
File.prototype.arrayBuffer = vi.fn().mockImplementation(function(this: File) {
  return Promise.resolve(new ArrayBuffer(this.size));
});

// Mock FileReader
Object.defineProperty(global, 'FileReader', {
  value: class MockFileReader {
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    result: string | ArrayBuffer | null = null;
    
    readAsDataURL(file: File) {
      setTimeout(() => {
        this.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA+Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBkZWZhdWx0IHF1YWxpdHkK/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBkRRCobHwFcHR4fEiJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A9/ooooA//9k=';
        this.onload?.call(this, {} as ProgressEvent<FileReader>);
      }, 0);
    }
    
    readAsArrayBuffer(file: File) {
      setTimeout(() => {
        this.result = new ArrayBuffer(file.size);
        this.onload?.call(this, {} as ProgressEvent<FileReader>);
      }, 0);
    }
  },
  configurable: true,
});

// Mock Audio APIs
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 128,
    getFloatFrequencyData: vi.fn(),
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createScriptProcessor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}));

// @ts-ignore
global.webkitAudioContext = global.AudioContext;

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  mimeType: 'audio/webm',
  ondataavailable: null,
  onstart: null,
  onstop: null,
  onerror: null,
  onpause: null,
  onresume: null,
}));

// @ts-ignore
global.MediaRecorder.isTypeSupported = vi.fn(() => true);

// Mock getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn(() => []),
      getAudioTracks: vi.fn(() => []),
      getVideoTracks: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getDisplayMedia: vi.fn(),
  },
  configurable: true,
});

// Enhanced Blob mock with arrayBuffer support
global.Blob = class MockBlob {
  size: number;
  type: string;
  
  constructor(parts: any[] = [], options: { type?: string } = {}) {
    this.type = options.type || '';
    this.size = parts.reduce((size, part) => {
      if (typeof part === 'string') return size + part.length;
      if (part instanceof ArrayBuffer) return size + part.byteLength;
      if (part && typeof part.length === 'number') return size + part.length;
      return size;
    }, 0);
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text() {
    return Promise.resolve('mock text');
  }
  
  stream() {
    return new ReadableStream();
  }
  
  slice() {
    return new MockBlob();
  }
} as any;

// Mock Image constructor
Object.defineProperty(global, 'Image', {
  value: vi.fn().mockImplementation(() => ({
    onload: null,
    onerror: null,
    width: 1920,
    height: 1080,
    naturalWidth: 1920,
    naturalHeight: 1080,
    set src(value: string) {
      setTimeout(() => {
        this.onload?.();
      }, 0);
    }
  })),
  configurable: true,
});

// Mock Canvas and CanvasRenderingContext2D
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
  }),
  toBlob: vi.fn((callback, type = 'image/jpeg') => {
    const mockBlob = new Blob(['mock-image-data'], { type });
    setTimeout(() => callback(mockBlob), 0);
  }),
  toDataURL: vi.fn((type = 'image/jpeg') => {
    const format = type.includes('png') ? 'png' : 'jpeg';
    return `data:image/${format};base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA+Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBkZWZhdWx0IHF1YWxpdHkK/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBkRRCobHwFcHR4fEiJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A9/ooooA//9k=`;
  })
};

// Store the original createElement
const originalCreateElement = document.createElement;

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return originalCreateElement.call(document, tagName);
  }),
  configurable: true,
});

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'test-completion-id',
        choices: [
          {
            message: {
              content: 'Test response from OpenAI',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        model: 'gpt-4o-mini'
      }),
    },
  },
  audio: {
    speech: {
      create: vi.fn().mockResolvedValue(new Blob(['mock audio'], { type: 'audio/wav' })),
    },
    transcriptions: {
      create: vi.fn().mockResolvedValue({
        text: 'Mock transcription'
      }),
    },
  },
  responses: {
    create: vi.fn(),
  },
  vectorStores: {
    create: vi.fn(),
    files: {
      create: vi.fn(),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
  OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
}));

// Mock @openai/agents/realtime
vi.mock('@openai/agents/realtime', () => ({
  RealtimeSession: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    addAgent: vi.fn(),
    removeAgent: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    interrupt: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    sendMessage: vi.fn(),
    switchAgent: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isRecording: vi.fn().mockReturnValue(false),
    agents: [],
    currentAgent: null,
    status: 'disconnected',
    emit: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  RealtimeAgent: vi.fn().mockImplementation((config) => ({
    ...config,
    id: 'test-agent-id',
    name: config.name || 'Test Agent',
    instructions: config.instructions || 'Test instructions',
    tools: config.tools || [],
    toolLogic: config.toolLogic || {},
    downstreamAgents: config.downstreamAgents || [],
    publicDescription: config.publicDescription || 'Test agent description',
  })),
  OpenAIRealtimeWebRTC: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
}));

// Mock agent configurations
vi.mock('@/app/agentConfigs', () => ({
  agentConfigs: {
    'test-scenario': {
      name: 'Test Scenario',
      description: 'Test scenario description',
      agents: [
        {
          name: 'Test Agent',
          instructions: 'Test agent instructions',
          tools: [],
          toolLogic: {},
          downstreamAgents: [],
          publicDescription: 'Test agent for testing purposes'
        }
      ]
    }
  }
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn(),
    has: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    append: vi.fn(),
    getSetCookie: vi.fn(),
    entries: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    forEach: vi.fn(),
  })),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockResolvedValue(new Map()),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  connectionState: 'connected',
  iceConnectionState: 'connected',
  signalingState: 'stable',
}));

// Mock performance APIs
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  getEntries: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
};

// Mock crypto APIs
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-123'),
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
      verify: vi.fn().mockResolvedValue(true),
      generateKey: vi.fn().mockResolvedValue({}),
      importKey: vi.fn().mockResolvedValue({}),
      exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      deriveKey: vi.fn().mockResolvedValue({}),
      wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      unwrapKey: vi.fn().mockResolvedValue({}),
    },
  },
  configurable: true,
});

// Enhanced cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  // Reset DOM state
  document.body.innerHTML = '';
  // Reset any global state
  if (global.localStorage) {
    global.localStorage.clear();
  }
  if (global.sessionStorage) {
    global.sessionStorage.clear();
  }
});