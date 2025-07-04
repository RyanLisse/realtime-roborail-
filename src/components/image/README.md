# Image Processing Pipeline

A comprehensive image upload, processing, and GPT-4 Vision integration system built following TDD principles.

## Features

### 🖼️ Image Upload & Validation
- **Drag & drop interface** with file picker fallback
- **Multi-format support**: JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC/HEIF
- **File validation**: Size limits (10MB), dimension limits (4K), format verification
- **Content safety**: Header validation and corruption detection
- **Progressive upload** with real-time progress feedback

### 🔧 Image Processing
- **Automatic resizing** with aspect ratio preservation
- **Smart compression** with configurable quality settings
- **Format conversion** (HEIC → JPEG, etc.)
- **Client-side processing** for optimal performance
- **Memory-efficient** canvas-based operations

### 🤖 GPT-4 Vision Integration
- **Equipment analysis** with condition assessment
- **Text extraction** from technical diagrams
- **Maintenance recommendations** based on visual inspection
- **Batch processing** for multiple images
- **Context-aware analysis** with equipment history

### 👁️ Image Viewer
- **Zoom & pan** functionality
- **Rotation** support
- **Keyboard shortcuts** for navigation
- **Full-screen viewing** experience
- **Touch-friendly** controls

## Architecture

```
src/
├── components/image/
│   ├── ImageUpload.tsx        # Drag-drop upload interface
│   ├── ImageViewer.tsx        # Full-featured image viewer
│   ├── ImagePreview.tsx       # Thumbnail with analysis results
│   └── index.ts              # Component exports
├── lib/image/
│   ├── types.ts              # TypeScript definitions
│   ├── validation.ts         # File validation logic
│   ├── processing.ts         # Image processing utilities
│   ├── vision.ts             # GPT-4 Vision integration
│   └── index.ts              # Library exports
├── hooks/
│   ├── useImageUpload.ts     # Upload state management
│   └── useImageViewer.ts     # Viewer interactions
└── test/lib/image/
    ├── validation.test.ts    # Validation tests
    ├── processing.test.ts    # Processing tests
    └── vision.test.ts        # Vision API tests
```

## Usage

### Basic Image Upload

```tsx
import { ImageUpload } from '@/components/image';

function MyComponent() {
  const handleFilesAdded = (files: File[]) => {
    console.log('Files uploaded:', files);
  };

  return (
    <ImageUpload
      onFilesAdded={handleFilesAdded}
      multiple={true}
      accept="image/*"
    />
  );
}
```

### Image Analysis with GPT-4 Vision

```tsx
import { analyzeEquipmentImage } from '@/lib/image';

async function analyzeImage(file: File) {
  try {
    const analysis = await analyzeEquipmentImage(file);
    console.log('Equipment type:', analysis.equipmentType);
    console.log('Condition:', analysis.condition);
    console.log('Issues:', analysis.issues);
    console.log('Recommendations:', analysis.recommendations);
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}
```

### Image Viewer with Analysis

```tsx
import { ImageViewer } from '@/components/image';

function ImageViewerModal({ image, onClose }) {
  const handleAnalyze = async (imageFile) => {
    const analysis = await analyzeEquipmentImage(imageFile.file);
    // Handle analysis results
  };

  return (
    <ImageViewer
      image={image}
      onClose={onClose}
      onAnalyze={handleAnalyze}
    />
  );
}
```

## API Reference

### Image Types

```typescript
interface ImageFile {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  size: number;
  type: string;
  lastModified: number;
}

interface VisionAnalysisResult {
  description: string;
  equipmentType?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  issues?: string[];
  recommendations?: string[];
  confidence: number;
  extractedText?: string;
}
```

### Core Functions

#### `validateImage(file: File): Promise<ImageValidationResult>`
Validates image file format, size, and dimensions.

#### `processImage(file: File, options?: ImageProcessingOptions): Promise<ProcessedImage>`
Processes image with resizing, compression, and format conversion.

#### `analyzeImage(file: File, prompt?: string): Promise<VisionAnalysisResult>`
Analyzes image using GPT-4 Vision with custom prompts.

#### `analyzeEquipmentImage(file: File): Promise<VisionAnalysisResult>`
Specialized analysis for equipment condition assessment.

#### `extractTextFromImage(file: File): Promise<VisionAnalysisResult>`
Extracts text content from technical diagrams and labels.

### Hooks

#### `useImageUpload()`
```typescript
const {
  files,           // Uploaded image files
  isUploading,     // Upload in progress
  isProcessing,    // Processing in progress
  error,           // Error message
  progress,        // Upload progress (0-100)
  addFiles,        // Add files programmatically
  removeFile,      // Remove specific file
  clearAll,        // Clear all files
  openFileDialog,  // Open file picker
  handleDrop,      // Handle drag & drop
  handleDragOver,  // Handle drag over
} = useImageUpload();
```

#### `useImageViewer()`
```typescript
const {
  scale,           // Current zoom level
  position,        // Pan position {x, y}
  rotation,        // Rotation angle
  zoomIn,          // Zoom in function
  zoomOut,         // Zoom out function
  resetView,       // Reset to default view
  fitToContainer,  // Fit image to container
  rotate,          // Rotate image
} = useImageViewer();
```

## Configuration

### Default Settings

```typescript
const IMAGE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024,     // 10MB
  maxDimension: 4096,                 // 4K resolution
  defaultQuality: 0.8,                // 80% compression
  defaultMaxWidth: 1920,              // Full HD width
  defaultMaxHeight: 1080,             // Full HD height
  supportedFormats: [                 // Supported formats
    'image/jpeg', 'image/png', 'image/webp',
    'image/gif', 'image/bmp', 'image/tiff',
    'image/heic', 'image/heif'
  ]
};
```

## Testing

The image processing pipeline includes comprehensive tests with >95% coverage:

```bash
# Run all image tests
npm run test src/test/lib/image

# Run specific test suites
npm run test src/test/lib/image/validation.test.ts
npm run test src/test/lib/image/processing.test.ts
npm run test src/test/lib/image/vision.test.ts
```

### Test Coverage
- ✅ **Image validation** (file format, size, dimensions)
- ✅ **Image processing** (resize, compress, convert)
- ✅ **GPT-4 Vision integration** (analysis, error handling)
- ✅ **Upload state management** (progress, errors)
- ✅ **Viewer interactions** (zoom, pan, rotate)

## Integration Points

### Chat Interface Integration
```typescript
// Export for chat integration
export { analyzeImage, formatAnalysisForChat } from '@/lib/image';

// Usage in chat
const analysisText = formatAnalysisForChat(analysis);
// Send analysisText to chat
```

### Equipment Maintenance Workflow
```typescript
// Analyze equipment condition
const analysis = await analyzeEquipmentImage(imageFile);

// Generate maintenance workflow
if (analysis.condition === 'poor') {
  // Trigger immediate maintenance alert
} else if (analysis.issues?.length > 0) {
  // Schedule preventive maintenance
}
```

## Performance Considerations

- **Client-side processing** reduces server load
- **Progressive image loading** with lazy loading
- **Memory cleanup** with URL.revokeObjectURL()
- **Efficient canvas operations** with reusable contexts
- **Batch processing** for multiple images

## Browser Compatibility

- **Modern browsers** with Canvas API support
- **File API** for drag & drop functionality
- **WebRTC** for camera capture (future feature)
- **Progressive enhancement** for older browsers

## Future Enhancements

- [ ] **Camera capture** integration
- [ ] **Image editing** tools (crop, filter, annotate)
- [ ] **Cloud storage** integration
- [ ] **Offline processing** with Web Workers
- [ ] **AI-powered auto-tagging**
- [ ] **EXIF data extraction**
- [ ] **Image similarity search**

## Contributing

When contributing to the image processing pipeline:

1. **Follow TDD principles** - write tests first
2. **Maintain >95% test coverage**
3. **Use TypeScript strictly** - no `any` types
4. **Document new features** in this README
5. **Optimize for performance** - profile before optimizing

## License

This image processing pipeline is part of the OpenAI Realtime Agents project.