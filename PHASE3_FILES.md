# Phase 3: PDF and Audio File Processing

## Overview

Phase 3 adds support for processing PDF and audio files, extracting text content, and adding it to the RAG knowledge base (Qdrant).

## Architecture

```
┌─────────────┐
│   Client    │
│  (File)     │
└──────┬──────┘
       │ HTTP POST
       │ (multipart/form-data)
       ▼
┌─────────────────────────────────────┐
│      NestJS API (Port 3000)         │
│  ┌─────────────────────────────┐   │
│  │  POST /file/upload/pdf       │   │
│  │  POST /file/upload/audio    │   │
│  └──────┬──────────────────────┘   │
│         │                            │
│  ┌──────▼──────────────────────┐   │
│  │     File Processing          │   │
│  │  - PDF: Extract text        │   │
│  │  - Audio: Transcribe to text │   │
│  └──────┬──────────────────────┘   │
│         │                            │
│  ┌──────▼──────────────────────┐   │
│  │     Text Service             │   │
│  │  - Chunk text                │   │
│  │  - Generate embeddings       │   │
│  │  - Store in Qdrant           │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

## API Endpoints

### Upload PDF File

```bash
curl -X POST http://localhost:3000/file/upload/pdf \
  -F "file=@/path/to/document.pdf"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed PDF: document.pdf",
  "sourceId": "pdf_1234567890_abc123",
  "chunks": 15,
  "textLength": 12500,
  "metadata": {
    "filename": "document.pdf",
    "fileType": "pdf",
    "fileSize": 245678,
    "mimeType": "application/pdf",
    "uploadedAt": 1234567890
  }
}
```

### Upload Audio File

```bash
curl -X POST http://localhost:3000/file/upload/audio \
  -F "file=@/path/to/recording.mp3"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed audio: recording.mp3",
  "sourceId": "audio_1234567890_xyz789",
  "chunks": 8,
  "textLength": 3200,
  "metadata": {
    "filename": "recording.mp3",
    "fileType": "audio",
    "fileSize": 987654,
    "mimeType": "audio/mpeg",
    "uploadedAt": 1234567890
  }
}
```

## Supported File Types

### PDF
- **MIME Type:** `application/pdf`
- **Max Size:** 50 MB
- **Library:** `pdf-parse`

### Audio
- **Supported Formats:**
  - MP3 (`audio/mpeg`, `audio/mp3`)
  - WAV (`audio/wav`)
  - WebM (`audio/webm`)
  - OGG (`audio/ogg`)
  - M4A (`audio/m4a`, `audio/x-m4a`)
- **Max Size:** 50 MB
- **Transcription:** OpenAI Whisper API (requires API key)

## Configuration

### Environment Variables

**NestJS API:**
```env
# File Upload
UPLOAD_DIR=./uploads

# Audio Transcription (OpenAI Whisper)
OPENAI_API_KEY=your-openai-api-key  # Required for audio transcription
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional, defaults to OpenAI

# Audio Transcription (Alternative - Whisper Service)
WHISPER_API_URL=http://whisper:8080  # Optional, for custom Whisper service
WHISPER_MODEL=whisper-1  # Optional
```

### Docker Compose

The `docker-compose.yml` is already configured with:
- Upload directory volume mount (`./nestjs-api/uploads:/app/uploads`)
- Environment variables for file processing

## Audio Transcription Setup

### Option 1: OpenAI Whisper API (Recommended)

1. Get an OpenAI API key from https://platform.openai.com/
2. Add to `docker-compose.yml`:
   ```yaml
   environment:
     - OPENAI_API_KEY=sk-your-api-key-here
   ```
3. Restart the service:
   ```bash
   docker-compose restart nestjs-api
   ```

### Option 2: Local Whisper Service

You can set up a local Whisper service and configure `WHISPER_API_URL`.

## File Processing Flow

1. **File Upload:**
   - Client sends file via multipart/form-data
   - File is validated (type, size)
   - File is saved temporarily to disk

2. **Text Extraction:**
   - **PDF:** Text extracted using `pdf-parse`
   - **Audio:** Audio transcribed to text using Whisper

3. **Text Processing:**
   - Extracted text is chunked (using existing TextService)
   - Embeddings are generated
   - Chunks are stored in Qdrant

4. **Cleanup:**
   - Temporary file is deleted

## Error Handling

### Common Errors

**"File type ... is not supported"**
- Solution: Ensure file is PDF or supported audio format

**"File size ... exceeds maximum allowed size"**
- Solution: Reduce file size (max 50 MB)

**"No audio transcription service available"**
- Solution: Configure `OPENAI_API_KEY` or set up Whisper service

**"PDF contains no extractable text"**
- Solution: PDF might be image-based or corrupted. Try OCR conversion first.

## Testing

### Test PDF Upload

```bash
# Create a test PDF (if you have one)
curl -X POST http://localhost:3000/file/upload/pdf \
  -F "file=@test.pdf"
```

### Test Audio Upload

```bash
# Upload an audio file (requires OpenAI API key)
curl -X POST http://localhost:3000/file/upload/audio \
  -F "file=@recording.mp3"
```

### Verify Content in Knowledge Base

```bash
# List all chunks
curl http://localhost:3000/text

# Search for content
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What was mentioned in the PDF/audio?"}'
```

## Logging

All file processing operations are logged with detailed information:
- File upload details (size, type, filename)
- Text extraction progress (pages, text length, duration)
- Transcription progress (text length, duration)
- Chunking and embedding generation
- Storage operations

Watch logs in real-time:
```bash
docker-compose logs -f nestjs-api | grep -E "FileService|AudioService|FileController"
```

## Limitations

1. **PDF:** 
   - Text-based PDFs work best
   - Image-based PDFs may not extract text (would need OCR)

2. **Audio:**
   - Requires OpenAI API key or Whisper service
   - Large audio files may take significant time to transcribe
   - Best results with clear, single-speaker audio

3. **File Size:**
   - Maximum 50 MB per file
   - Can be adjusted via `multerConfig.limits.fileSize`

## Next Steps

- Add OCR support for image-based PDFs
- Implement local Whisper service integration
- Add support for more audio formats
- Add batch file upload support
- Implement file metadata extraction
