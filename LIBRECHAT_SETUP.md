# LibreChat Integration Setup Guide

## Overview

This guide explains how LibreChat is integrated with the RAG system to use Qdrant as the knowledge base.

## Architecture

```
┌─────────────┐
│  LibreChat  │
│   (UI)      │
└──────┬──────┘
       │ HTTP
       │ (OpenAI-compatible API)
       ▼
┌─────────────────────────────────────┐
│      NestJS API (Port 3000)         │
│  ┌─────────────────────────────┐   │
│  │  /v1/chat/completions        │   │
│  │  (OpenAI-compatible endpoint)│   │
│  └──────┬──────────────────────┘   │
│         │                            │
│  ┌──────▼──────────────────────┐   │
│  │      RAG Chat Service        │   │
│  │  1. Generate query embedding │   │
│  │  2. Search Qdrant (top-K)    │   │
│  │  3. Create context prompt    │   │
│  │  4. Generate LLM response    │   │
│  └──────┬──────────────────────┘   │
│         │                            │
└─────────┼────────────────────────────┘
          │
     ┌────┴────┐         ┌──────────┐
     │ Qdrant │         │  Ollama  │
     │ (KB)   │         │   (LLM)  │
     └────────┘         └──────────┘
```

## How It Works

1. **User sends message in LibreChat UI**
2. **LibreChat forwards request to NestJS** at `http://nestjs-api:3000/v1/chat/completions`
3. **NestJS RAG endpoint:**
   - Extracts the user query from OpenAI format
   - Generates embedding for the query using Ollama
   - Searches Qdrant vector database for relevant chunks (top-K similarity)
   - Constructs context-aware prompt with retrieved chunks
   - Sends prompt to Ollama LLM for response generation
   - Returns OpenAI-compatible response to LibreChat
4. **LibreChat displays the response** to the user

## Setup Instructions

### 1. Start All Services

```bash
docker-compose up -d
```

This will start:
- Qdrant (port 6333)
- Ollama (port 11434)
- NestJS API (port 3000)
- MongoDB (port 27017) - required by LibreChat
- LibreChat (port 3080)

### 2. Wait for Services to Initialize

```bash
# Check all services are running
docker-compose ps

# Watch logs to ensure services are ready
docker-compose logs -f
```

### 3. Access LibreChat UI

Open your browser and navigate to:
```
http://localhost:3080
```

### 4. Configure LibreChat

#### Option A: Using Environment Variables (Already Configured)

The docker-compose.yml already sets:
- `OPENAI_BASE_URL=http://nestjs-api:3000/v1` - Points to our RAG endpoint
- `OPENAI_API_KEY=sk-librechat-rag` - API key (LibreChat requires one)

#### Option B: Manual Configuration in LibreChat UI

1. Log into LibreChat
2. Go to Settings → AI
3. Add a new endpoint:
   - **Name**: RAG Chatbot
   - **API Key**: `sk-librechat-rag`
   - **Base URL**: `http://localhost:3000/v1`
   - **Model**: `rag-llama3`

### 5. Add Knowledge Base Content

Before chatting, add some content to Qdrant:

```bash
# Submit text to the knowledge base
curl -X POST http://localhost:3000/text/submit \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your long text content here...",
    "metadata": {
      "title": "Document Title",
      "author": "Author Name"
    }
  }'
```

### 6. Test the Integration

1. Open LibreChat UI at `http://localhost:3080`
2. Start a new conversation
3. Ask a question about the content you added
4. The system will:
   - Retrieve relevant chunks from Qdrant
   - Generate a context-aware response using Ollama
   - Display the answer in LibreChat

## API Endpoints

### OpenAI-Compatible Endpoints (for LibreChat)

- **POST /v1/chat/completions** - Chat endpoint
- **GET /v1/models** - List available models

### RAG System Endpoints

- **POST /text/submit** - Add text to knowledge base
- **GET /text** - List all stored chunks
- **DELETE /text/:sourceId** - Delete text by source ID
- **POST /chat** - Direct RAG chat (alternative to OpenAI format)
- **GET /health** - Health check

## Troubleshooting

### LibreChat Can't Connect to RAG Endpoint

1. Verify NestJS API is running:
   ```bash
   curl http://localhost:3000/health
   ```

2. Test OpenAI endpoint:
   ```bash
   curl http://localhost:3000/v1/models
   ```

3. Check LibreChat logs:
   ```bash
   docker-compose logs librechat
   ```

### No Responses from Knowledge Base

1. Verify content exists in Qdrant:
   ```bash
   curl http://localhost:3000/text
   ```

2. Add content if empty:
   ```bash
   curl -X POST http://localhost:3000/text/submit \
     -H "Content-Type: application/json" \
     -d '{"text": "Test content for RAG system"}'
   ```

3. Check Qdrant directly:
   ```bash
   curl http://localhost:6333/collections/text_chunks
   ```

### MongoDB Connection Issues

1. Check MongoDB is running:
   ```bash
   docker-compose ps mongodb
   ```

2. Check MongoDB logs:
   ```bash
   docker-compose logs mongodb
   ```

3. Verify connection string in docker-compose.yml matches service name

## Configuration Details

### Environment Variables

**NestJS API:**
- `OLLAMA_API_URL=http://ollama:11434/v1`
- `QDRANT_URL=http://qdrant:6333`
- `OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest`
- `OLLAMA_CHAT_MODEL=llama3:8b`

**LibreChat:**
- `OPENAI_BASE_URL=http://nestjs-api:3000/v1` - Our RAG endpoint
- `OPENAI_API_KEY=sk-librechat-rag` - Required API key
- `MONGO_URI=mongodb://mongodb:27017/LibreChat` - MongoDB connection

### Model Configuration

The system exposes a model called `rag-llama3` which LibreChat can use. This model:
- Uses Qdrant for knowledge retrieval
- Uses Ollama's `llama3:8b` for response generation
- Automatically retrieves relevant context before generating responses

## Next Steps

- [ ] Add more content to knowledge base
- [ ] Test different types of questions
- [ ] Monitor RAG performance
- [ ] Fine-tune chunk size and overlap if needed
- [ ] Add file upload support (Phase 3)

