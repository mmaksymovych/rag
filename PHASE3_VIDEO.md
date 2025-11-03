# Phase 3 Extension: Video Processing with Whisper Transcription

## Overview

This extension adds support for processing video files (MP4 and other formats), extracting audio, transcribing with Whisper, and embedding the content in the RAG knowledge base.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Video)    │
└──────┬──────┘
       │ HTTP POST (streaming)
       │ (multipart/form-data)
       ▼
┌─────────────────────────────────────┐
│      NestJS API (Port 3000)         │
│  ┌─────────────────────────────┐   │
│  │  POST /file/upload/video    │   │
│  │  (disk storage for streaming)│   │
│  └──────┬──────────────────────┘   │
│         │                            │
│  ┌──────▼──────────────────────┐   │
│  │     Video Processing         │   │
│  │  1. Save video to disk       │   │
│  │  2. Extract audio (ffmpeg)   │   │
│  │  3. Transcribe (Whisper)     │   │
│  │  4. Chunk text               │   │
│  │  5. Generate embeddings      │   │
│  │  6. Store in Qdrant          │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Features

- **Streaming Upload**: Large video files are streamed directly to disk (not loaded into memory)
- **Audio Extraction**: Automatically extracts audio track from video using ffmpeg
- **Whisper Transcription**: Uses OpenAI Whisper API to transcribe audio to text
- **Video Metadata**: Captures video duration, format, and other metadata
- **Automatic Cleanup**: Temporary video and audio files are automatically deleted

## API Endpoint

### Upload Video File

```bash
curl -X POST http://localhost:3000/file/upload/video \
  -F "file=@/path/to/video.mp4"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed video: video.mp4",
  "sourceId": "video_1234567890_abc123",
  "chunks": 25,
  "textLength": 12500,
  "metadata": {
    "filename": "video.mp4",
    "fileType": "video",
    "fileSize": 45678901,
    "mimeType": "video/mp4",
    "uploadedAt": 1234567890,
    "videoDuration": 300.5,
    "videoFormat": "mov,mp4,m4a,3gp,3g2,mj2"
  }
}
```

## Supported Video Formats

- **MP4** (`video/mp4`)
- **MPEG** (`video/mpeg`)
- **QuickTime** (`video/quicktime`)
- **AVI** (`video/x-msvideo`)
- **WebM** (`video/webm`)
- **MKV** (`video/x-matroska`)
- **OGG** (`video/ogg`)

**Max File Size:** 500 MB (configurable)

## Prerequisites

### 1. FFmpeg Installation

FFmpeg is required for extracting audio from video files. It's automatically installed in the Docker container.

For local development:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Check installation
ffmpeg -version
```

### 2. OpenAI API Key

Whisper transcription requires an OpenAI API key. Configure it in `docker-compose.yml`:

```yaml
environment:
  - OPENAI_API_KEY=sk-your-api-key-here
```

## Configuration

### Environment Variables

```env
# Video Processing
UPLOAD_DIR=./uploads  # Directory for temporary file storage

# OpenAI Whisper (required for transcription)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional
```

### Docker Configuration

The Docker image includes:
- **FFmpeg**: For video/audio processing
- **Node.js 20**: Runtime environment
- **All npm dependencies**: Including `fluent-ffmpeg`

## Processing Flow

1. **Upload**: Video file is streamed to disk (not loaded into memory)
2. **Metadata Extraction**: Video duration, format, and properties are extracted
3. **Audio Extraction**: Audio track is extracted using ffmpeg to MP3 format
4. **Transcription**: Audio is transcribed to text using OpenAI Whisper
5. **Text Processing**: Transcribed text is chunked using existing pipeline
6. **Embedding**: Chunks are converted to embeddings
7. **Storage**: Embeddings are stored in Qdrant
8. **Cleanup**: Temporary video and audio files are deleted

## Example Usage

### Upload a Video File

```bash
curl -X POST http://localhost:3000/file/upload/video \
  -F "file=@recording.mp4" \
  -v
```

### Verify Content in Knowledge Base

```bash
# List all chunks
curl http://localhost:3000/text

# Search for video content
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What was discussed in the video?", "topK": 5}'
```

## Performance Considerations

### Large Files

- Files are streamed to disk (not loaded into memory)
- Maximum file size: 500 MB (can be adjusted)
- Processing time depends on:
  - Video duration
  - File size
  - Transcription API response time

### Resource Usage

- **Disk Space**: Temporary files require disk space during processing
- **CPU**: FFmpeg audio extraction uses CPU resources
- **Network**: Whisper API calls require internet connection
- **Memory**: Minimal memory usage due to streaming

## Error Handling

### Common Errors

**"ffmpeg is not installed or not available"**
- Solution: Ensure ffmpeg is installed and in PATH
- Docker: Already included in the image

**"No audio transcription service available"**
- Solution: Configure `OPENAI_API_KEY` in environment variables

**"File size exceeds maximum allowed size"**
- Solution: Reduce file size or increase `fileSize` limit in `videoMulterConfig`

**"Video format not supported"**
- Solution: Convert video to supported format (MP4 recommended)

## Logging

All video processing steps are logged:

```bash
# Watch video processing logs
docker-compose logs -f nestjs-api | grep -E "VideoService|VideoController|ffmpeg|transcription"
```

Example log output:
```
[FileController] Processing video upload - Filename: video.mp4, Size: 45678901 bytes
[FileController] Video metadata - Duration: 300.5s, Format: mov,mp4,m4a,3gp,3g2,mj2
[VideoService] Extracting audio from video: /app/uploads/1234567890_video.mp4
[VideoService] FFmpeg command: ffmpeg -i ... -acodec libmp3lame -ab 128k ...
[VideoService] Processing: 50% done
[VideoService] Audio extraction completed
[AudioService] Transcribing audio file: /app/uploads/1234567890_video_audio.mp3
[AudioService] Audio transcription completed - Text length: 12500 chars
[FileController] Video processed successfully - Source ID: video_1234567890_abc123, Chunks: 25
```

## Limitations

1. **Transcription Quality**: Depends on audio quality and clarity
2. **Processing Time**: Large videos may take significant time to process
3. **Storage**: Temporary files require disk space (cleaned up automatically)
4. **API Costs**: OpenAI Whisper API usage incurs costs based on audio duration
5. **Language**: Defaults to English (can be configured in Whisper API call)

## Future Enhancements

- [ ] Support for multiple audio tracks
- [ ] Video frame extraction and OCR
- [ ] Local Whisper model support (via Ollama or other)
- [ ] Batch video processing
- [ ] Progress tracking for long-running uploads
- [ ] Automatic language detection
- [ ] Subtitle file extraction

## Testing

### Test Video Upload

```bash
# Upload a test video
curl -X POST http://localhost:3000/file/upload/video \
  -F "file=@test-video.mp4"
```

### Verify Processing

```bash
# Check logs
docker-compose logs nestjs-api | tail -50

# Verify in Qdrant
curl -X POST http://localhost:6333/collections/text_chunks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "with_payload": true}' | \
  jq '.result.points[] | select(.payload.sourceId | startswith("video_"))'
```

## Troubleshooting

### FFmpeg Not Found

```bash
# Check if ffmpeg is available in container
docker exec -it rag-nestjs-api-1 ffmpeg -version

# If not available, rebuild container
docker-compose build nestjs-api
docker-compose up -d nestjs-api
```

### Transcription Fails

1. Check OpenAI API key is configured:
   ```bash
   docker-compose exec nestjs-api env | grep OPENAI_API_KEY
   ```

2. Verify API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

3. Check audio file was created:
   ```bash
   docker-compose exec nestjs-api ls -lh /app/uploads/*_audio.mp3
   ```

### Large File Upload Issues

1. Increase timeout in Nginx/proxy (if using):
   ```nginx
   client_max_body_size 500M;
   proxy_read_timeout 600s;
   ```

2. Check disk space:
   ```bash
   df -h
   ```

3. Verify upload directory permissions:
   ```bash
   ls -la nestjs-api/uploads/
   ```
