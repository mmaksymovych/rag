# RAG Chatbot System

A Retrieval-Augmented Generation (RAG) chatbot system built with NestJS, Ollama, and Qdrant that processes multiple document types (text, PDF, audio, video) and enables semantic search through a vector database.

## Architecture

### System Overview

The system follows a microservices architecture using Docker Compose:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│              Open WebUI (Port 3080)                          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP (OpenAI-compatible API)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 NestJS API (Port 3000)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ File Upload  │  │ Text Process │  │ RAG Chat     │    │
│  │ & Processing │  │ & Chunking    │  │ Service      │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐    │
│  │ PDF Extract  │  │ Text Chunking │  │ Embeddings   │    │
│  │ Audio Trans. │  │ (with overlap)│  │ Generation   │    │
│  │ Video Process│  │               │  │              │    │
│  └──────────────┘  └───────────────┘  └──────┬───────┘    │
└───────────────────────────────────────────────┼───────────┘
                                                 │
                    ┌───────────────────────────┼───────────┐
                    │                           │             │
                    ▼                           ▼             ▼
         ┌──────────────┐            ┌──────────────┐  ┌──────────────┐
         │   Qdrant     │            │   Ollama     │  │ Hugging Face │
         │ (Vector DB)  │            │   (LLM &     │  │   Whisper    │
         │  Port 6333   │            │ Embeddings)  │  │  (Local ASR) │
         └──────────────┘            │  Port 11434  │  └──────────────┘
                                     └──────────────┘
```

### Components

- **NestJS API**: Text processing, chunking, embedding, and RAG chat service
- **Ollama**: Local LLM for embeddings and chat completions (OpenAI-compatible API)
- **Qdrant**: Vector database for semantic search
- **Open WebUI**: Simple, user-friendly web UI for chatting with the RAG system
- **Docker**: Containerization for all services

### Processing Pipeline

```
┌─────────┐
│ Upload  │ → File saved to disk (streaming for large files)
└────┬────┘
     │
     ▼
┌─────────────┐
│ Extraction  │ → Text/PDF: direct extraction
│             │   Audio/Video: transcription via Whisper
└────┬────────┘
     │
     ▼
┌───────────┐
│ Chunking  │ → Text split into overlapping chunks with metadata
└────┬──────┘
     │
     ▼
┌────────────┐
│ Embedding  │ → Each chunk converted to vector embeddings
└────┬───────┘
     │
     ▼
┌───────────┐
│ Storage   │ → Embeddings stored in Qdrant with metadata
└────┬──────┘
     │
     ▼
┌─────────┐
│ Query   │ → User query → Embedding → Search → RAG → Response
└─────────┘
```

## Prerequisites

- Docker and Docker Compose
- NVIDIA GPU (recommended for Ollama)

## Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd rag-chatbot
   cp env.example .env
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```

3. **Wait for services to be ready:**
   - Qdrant: http://localhost:6333
   - Ollama: http://localhost:11434
   - NestJS API: http://localhost:3000
   - Open WebUI: http://localhost:3080

4. **Test the system:**
   ```bash
   # Submit text for processing
   curl -X POST http://localhost:3000/text/submit \
     -H "Content-Type: application/json" \
     -d '{"text": "Your text content here", "metadata": {"title": "Test Document"}}'

   # Chat with the system
   curl -X POST http://localhost:3000/chat \
     -H "Content-Type: application/json" \
     -d '{"query": "What is this about?", "topK": 5}'
   ```

## Features

### Document Processing
- **Text**: Direct text input with metadata
- **PDF**: Automatic text extraction
- **Audio**: Local transcription using Hugging Face Whisper models (no API key needed)
- **Video**: Audio extraction and transcription

### Intelligent Text Chunking
- Configurable chunk size (default: 1000 chars)
- Overlap between chunks (default: 100 chars) to maintain context
- Automatic metadata preservation

### Vector Embeddings & Semantic Search
- Uses Ollama's `nomic-embed-text` model for embeddings
- Stores embeddings in Qdrant vector database
- Semantic search with configurable top-K results

### RAG-Enhanced Chat
- Retrieves relevant context from vector database
- Generates responses using Ollama's `llama3:8b` model
- OpenAI-compatible API for easy UI integration

### Local-First Architecture
- All processing happens locally (privacy-friendly)
- No external API dependencies (except optional OpenAI Whisper fallback)
- Models cached locally for faster subsequent runs

## API Endpoints

### Text Processing
- `POST /text/submit` - Submit text for embedding
- `GET /text` - List stored text chunks
- `DELETE /text/:sourceId` - Remove text from vector DB

### File Processing
- `POST /file/upload/pdf` - Upload and process PDF file
- `POST /file/upload/audio` - Upload and transcribe audio file
- `POST /file/upload/video` - Upload and process video file (extracts audio, transcribes, and embeds)

### Chat
- `POST /chat` - RAG-enhanced chat (custom format)
- `POST /v1/chat/completions` - OpenAI-compatible endpoint for Open WebUI
- `GET /v1/models` - OpenAI-compatible models list
- `GET /chat/models` - List available models

### Health
- `GET /health` - Health check

## Configuration

Environment variables in `docker-compose.yml`:

```env
# Ollama Configuration
OLLAMA_API_URL=http://ollama:11434/v1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
OLLAMA_CHAT_MODEL=llama3:8b
OLLAMA_TIMEOUT_SECONDS=600

# Qdrant Configuration
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=text_chunks

# Text Processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=100
MAX_TEXT_LENGTH=100000

# File Upload
UPLOAD_DIR=/app/uploads

# Local Whisper Configuration (no API key needed!)
USE_LOCAL_WHISPER=true
WHISPER_MODEL=Xenova/whisper-small

# Optional: Fallback to OpenAI Whisper API
# OPENAI_API_KEY=your-openai-api-key
# OPENAI_BASE_URL=https://api.openai.com/v1
```

## Usage Examples

### Upload a PDF
```bash
curl -X POST http://localhost:3000/file/upload/pdf \
  -F "file=@document.pdf"
```

### Upload an Audio File
```bash
curl -X POST http://localhost:3000/file/upload/audio \
  -F "file=@recording.mp3"
```

### Upload a Video File
```bash
curl -X POST http://localhost:3000/file/upload/video \
  -F "file=@video.mp4"
```

### Chat with the System
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is artificial intelligence?"}'
```

### Access Web UI
Open http://localhost:3080 in your browser and start chatting with the RAG system.

## Supported File Types

### PDF
- **MIME Type:** `application/pdf`
- **Max Size:** 50 MB
- **Library:** `pdf-parse`

### Audio
- **Supported Formats:** MP3, WAV, WebM, OGG, M4A
- **Max Size:** 50 MB
- **Transcription:** Local Hugging Face Whisper (default) or OpenAI Whisper API (optional)

### Video
- **Supported Formats:** MP4, MPEG, QuickTime, AVI, WebM, MKV, OGG
- **Max Size:** 1 GB
- **Processing:** Video → Audio extraction (FFmpeg) → Transcription → Embedding

## Development

To run in development mode:

```bash
cd nestjs-api
npm install
npm run start:dev
```

## Troubleshooting

### Ollama models not loading
- Check Ollama logs: `docker-compose logs ollama`
- Manually pull models: `docker exec -it rag-ollama-1 ollama pull nomic-embed-text`

### Qdrant connection issues
- Check Qdrant logs: `docker-compose logs qdrant`
- Verify Qdrant is accessible: `curl http://localhost:6333/health`

### NestJS API issues
- Check API logs: `docker-compose logs nestjs-api`
- Verify environment variables are set correctly

### Audio transcription issues
- Ensure FFmpeg is installed in the container
- Check Hugging Face model cache: `ls -lh huggingface_cache/`
- For local Whisper failures, check logs for specific error messages

### High CPU usage
- Normal during LLM inference and embedding generation
- Consider reducing `max_tokens` or `topK` values
- Monitor resource usage: `docker stats`

## Documentation

- [Local Whisper Setup](./LOCAL_WHISPER_SETUP.md) - Configuration for local audio transcription
- [Project Review](./NOTION_REVIEW.md) - Comprehensive project documentation and review
- [Requirements](./requirements.txt) - Complete list of dependencies

## License

MIT
