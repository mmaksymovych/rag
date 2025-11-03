# RAG Chatbot System - Project Review

## 1. Described Solution

### Overview
A complete **Retrieval-Augmented Generation (RAG) chatbot system** that processes multiple document types (text, PDF, audio, video) and enables semantic search through a vector database. The system allows users to upload content, automatically extract and transcribe it, and then query it through an AI-powered chat interface.

### Architecture

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
         │ (Vector DB)  │            │   (LLM &    │  │   Whisper    │
         │  Port 6333   │            │ Embeddings) │  │  (Local ASR) │
         └──────────────┘            │  Port 11434 │  └──────────────┘
                                     └──────────────┘
```

### Key Features

1. **Multi-Format Document Processing**
   - **Text**: Direct text input with metadata
   - **PDF**: Automatic text extraction using `pdf-parse`
   - **Audio**: Local transcription using Hugging Face Whisper models (no API key needed)
   - **Video**: Audio extraction via FFmpeg + transcription

2. **Intelligent Text Chunking**
   - Configurable chunk size (default: 1000 chars)
   - Overlap between chunks (default: 100 chars) to maintain context
   - Automatic metadata preservation

3. **Vector Embeddings & Semantic Search**
   - Uses Ollama's `nomic-embed-text` model for embeddings
   - Stores embeddings in Qdrant vector database
   - Semantic search with configurable top-K results

4. **RAG-Enhanced Chat**
   - Retrieves relevant context from vector database
   - Generates responses using Ollama's `llama3:8b` model
   - OpenAI-compatible API for easy UI integration

5. **Local-First Architecture**
   - All processing happens locally (privacy-friendly)
   - No external API dependencies (except optional OpenAI Whisper fallback)
   - Models cached locally for faster subsequent runs

### Processing Pipeline

1. **Upload** → File saved to disk (streaming for large files)
2. **Extraction** → Text/PDF: direct extraction | Audio/Video: transcription via Whisper
3. **Chunking** → Text split into overlapping chunks with metadata
4. **Embedding** → Each chunk converted to vector embeddings
5. **Storage** → Embeddings stored in Qdrant with metadata
6. **Query** → User query → Embedding → Search → RAG → Response

---

## 2. APIs

### REST Endpoints

#### Text Processing
- **`POST /text/submit`** - Submit text for embedding
  - Body: `{ "text": string, "metadata": object }`
  - Response: `{ "success": boolean, "sourceId": string, "chunks": number }`

- **`GET /text`** - List stored text chunks
  - Response: Array of text chunks with metadata

- **`DELETE /text/:sourceId`** - Remove text from vector DB
  - Response: `{ "success": boolean, "message": string }`

#### File Processing
- **`POST /file/upload/pdf`** - Upload and process PDF
  - Form data: `file` (multipart/form-data)
  - Max size: 50MB
  - Response: `{ "success": boolean, "sourceId": string, "chunks": number, "textLength": number }`

- **`POST /file/upload/audio`** - Upload and transcribe audio
  - Form data: `file` (multipart/form-data)
  - Supported: MP3, WAV, WebM, OGG, M4A
  - Max size: 50MB
  - Uses local Hugging Face Whisper (no API key needed)
  - Response: `{ "success": boolean, "sourceId": string, "chunks": number, "textLength": number }`

- **`POST /file/upload/video`** - Upload and process video
  - Form data: `file` (multipart/form-data)
  - Supported: MP4, MPEG, QuickTime, AVI, WebM, MKV, OGG
  - Max size: 1GB
  - Process: Video → Audio extraction (FFmpeg) → Transcription (Whisper) → Embedding
  - Response: `{ "success": boolean, "sourceId": string, "chunks": number, "textLength": number, "metadata": { "videoDuration": number } }`

#### Chat
- **`POST /chat`** - RAG-enhanced chat (custom format)
  - Body: `{ "query": string, "topK": number }`
  - Response: `{ "response": string, "context": Array<SearchResult>, "sources": string[] }`

- **`POST /v1/chat/completions`** - OpenAI-compatible endpoint
  - Compatible with OpenAI API format
  - Used by Open WebUI for seamless integration
  - Body: OpenAI chat completion format
  - Response: OpenAI chat completion format

- **`GET /v1/models`** - List available models (OpenAI-compatible)
  - Response: List of available models

- **`GET /chat/models`** - List available models (custom format)
  - Response: `{ "chat": string, "embedding": string }`

#### Health
- **`GET /health`** - Health check
  - Response: `{ "status": "ok", "timestamp": string, "service": string, "version": string }`

---

## 3. Libraries

### Core Framework
- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) - Backend framework
- **TypeScript** - Language for type safety

### Vector Database
- **Qdrant** - Vector database for storing and searching embeddings
  - Docker image: `qdrant/qdrant:latest`
  - Port: 6333

### LLM & Embeddings
- **Ollama** - Local LLM and embeddings provider
  - Docker image: `ollama/ollama:latest`
  - Port: 11434
  - Models used:
    - `nomic-embed-text:latest` - Text embeddings (768 dimensions)
    - `llama3:8b` - Chat completions

### File Processing
- **pdf-parse** - PDF text extraction
- **fluent-ffmpeg** - Video processing and audio extraction
- **multer** (`@nestjs/platform-express`) - File upload handling
  - Memory storage for PDF/audio (small files)
  - Disk storage for video (large files, streaming)

### Audio Transcription
- **@xenova/transformers** - Local Hugging Face Whisper models
  - Model: `Xenova/whisper-small` (default)
  - Runs locally, no API key needed
  - Supports 99+ languages
  - Automatic chunking for long audio files (30s chunks with 5s overlap)

### HTTP Client
- **OpenAI SDK** (`openai`) - Used for Ollama API calls (OpenAI-compatible)
- **fetch** - Native Node.js fetch for API calls

### Configuration
- **@nestjs/config** - Environment variable management

### Utilities
- **fs/promises** - File system operations
- **path** - Path manipulation
- **child_process** - FFmpeg execution

### UI
- **Open WebUI** - Web interface for chatting
  - Docker image: `ghcr.io/open-webui/open-webui:main`
  - Port: 3080
  - OpenAI-compatible API integration

### Containerization
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

---

## Challenges & Learnings

### What was the most challenging part of this project?

#### 1. **Audio Transcription Implementation**
The most challenging aspect was implementing local audio transcription using Hugging Face Whisper models. Several technical hurdles had to be overcome:

- **Docker Base Image Compatibility**: Initially used Alpine Linux, but ONNX runtime (used by `@xenova/transformers`) requires glibc, which Alpine doesn't provide. Solution: Switched to Debian-based `node:20-slim` image.

- **Audio Format Handling**: The transformers.js library doesn't support direct file paths in Node.js environment (no AudioContext). Solution: Implemented FFmpeg conversion to 16kHz mono WAV, then parsed WAV headers to extract raw PCM data, converted to Float32Array format expected by Whisper.

- **Long Audio Processing**: Whisper defaults to 30-second chunks, causing incomplete transcriptions for long videos (39+ minutes). Solution: Configured `chunk_length_s: 30` and `stride_length_s: 5` parameters to process entire audio files with proper chunking and overlap.

#### 2. **Resource Management Under High Load**
During interaction with WebUI, CPU usage in Docker reached ~1000% (utilizing multiple cores). This was due to:
- Simultaneous LLM inference, embedding generation, and vector search
- Large context windows in RAG prompts
- Multiple concurrent requests

**Solutions implemented:**
- Increased `max_tokens` limit from 400 to 2048 for better quality responses
- Configurable timeout (increased from 90s to 600s default)
- Optimized chunking strategy to reduce redundant processing

#### 3. **UI Integration Challenges**
Initially attempted to use LibreChat, but encountered integration issues:
- Complex MongoDB setup requirements
- Configuration complexity for OpenAI-compatible endpoints
- Resource-intensive for the use case

**Solution**: Switched to Open WebUI, which:
- Simpler setup (no external database required)
- Built-in OpenAI-compatible API support
- Lighter resource footprint
- Better suited for local LLM deployments

#### 4. **Video Processing Pipeline**
Implementing video processing required:
- Large file handling (up to 1GB) with streaming uploads
- FFmpeg integration for audio extraction
- Proper cleanup of temporary files
- MIME type detection issues (handled via file extension fallback)

#### 5. **Timeout Configuration**
Initial 90-second timeout was insufficient for complex queries. Implemented:
- Configurable timeout via environment variable
- Increased default to 10 minutes (600 seconds)
- Option to disable timeout completely (not recommended for production)

### What new things did you learn or understand from this challenge?

#### Technical Learnings

1. **Vector Embeddings & Semantic Search**
   - Understanding how embeddings capture semantic meaning
   - Trade-offs between embedding dimensions, accuracy, and performance
   - Importance of chunking strategy (size, overlap) for context preservation

2. **Local LLM Deployment**
   - How to run LLMs locally without external APIs
   - Resource requirements and optimization strategies
   - Model caching and performance considerations

3. **Audio Processing Pipeline**
   - Audio format conversion (MP3/MP4 → WAV → PCM → Float32Array)
   - Whisper model architecture and chunking strategies
   - Handling long-form audio transcription

4. **Docker & Containerization**
   - Base image selection (Alpine vs Debian) for compatibility
   - Multi-container orchestration with Docker Compose
   - Volume management for model caching

5. **RAG Architecture**
   - How retrieval-augmented generation improves LLM responses
   - Context window management and prompt engineering
   - Balancing retrieval quality vs. response time

#### Process Learnings

1. **AI-Assisted Development**
   - This entire project was built using AI coding assistance without manually reviewing single code lines
   - Achieved 100% required end result through iterative AI collaboration
   - Demonstrates the future of software development where AI handles implementation details

2. **Iterative Problem Solving**
   - Each challenge required multiple iterations to solve
   - Importance of logging and debugging in distributed systems
   - Value of incremental testing at each stage

3. **Technology Selection**
   - Choosing the right tools for specific use cases (Open WebUI vs LibreChat)
   - Balancing feature richness vs. simplicity
   - Local-first vs. cloud-based architecture decisions

---

## Interesting Observations

### 1. Fully AI-Coded Application
**This entire application was built using AI coding assistance without manually reviewing a single code line, achieving 100% of the required end result.**

This experience highlights how software development may change in the near future:
- **AI as Implementation Partner**: The AI handled all implementation details, from architecture decisions to bug fixes
- **Iterative Refinement**: Through conversation, the AI refined the solution based on feedback and error messages
- **End-to-End Delivery**: From initial concept to fully functional system, including documentation
- **Quality Assurance**: Despite no manual code review, the system works correctly and handles edge cases

**Implications for Future Development:**
- Developers may focus more on high-level design and requirements
- AI handles boilerplate, integration, and implementation details
- Faster iteration cycles and rapid prototyping
- Need for better AI debugging and testing capabilities

### 2. Local-First Architecture Benefits
- **Privacy**: All data stays on local infrastructure
- **Cost**: No API costs for transcription or embeddings
- **Performance**: No network latency for model inference
- **Reliability**: No dependency on external service availability

### 3. Resource Intensity
- Modern AI workloads are resource-intensive but manageable with proper configuration
- Docker provides good isolation but requires careful resource allocation
- Local models trade off convenience for control and privacy

---

## Project Statistics

- **Total Services**: 4 (Qdrant, Ollama, NestJS API, Open WebUI)
- **API Endpoints**: 10+
- **Supported File Formats**: PDF, MP3, WAV, WebM, OGG, M4A, MP4, MPEG, QuickTime, AVI, MKV
- **Languages Supported**: 99+ (via Whisper)
- **Max File Sizes**: 50MB (PDF/Audio), 1GB (Video)
- **Vector Dimensions**: 768 (nomic-embed-text)
- **Default Chunk Size**: 1000 characters with 100 character overlap
- **LLM Timeout**: 600 seconds (10 minutes, configurable)

---

## Conclusion

This project successfully demonstrates a complete RAG system capable of processing multiple document types, generating embeddings, and providing AI-powered semantic search. The challenges encountered and solved provide valuable insights into modern AI application development, particularly around local model deployment, resource management, and AI-assisted development workflows.

