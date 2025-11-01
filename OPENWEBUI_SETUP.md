# Open WebUI Integration Guide

## Overview

Open WebUI is a simple, user-friendly chat interface designed specifically for Ollama and OpenAI-compatible APIs. It's much simpler than LibreChat and integrates seamlessly with our RAG system.

## Architecture

```
┌─────────────┐
│ Open WebUI  │
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

## Quick Start

### 1. Start Services

```bash
docker-compose up -d
```

This will start:
- Qdrant (port 6333)
- Ollama (port 11434)
- NestJS API (port 3000)
- Open WebUI (port 3080)

### 2. Access Open WebUI

Open your browser and navigate to:
```
http://localhost:3080
```

### 3. First-Time Setup

1. **Create an account** - The first user to register becomes the admin
2. **Add OpenAI Connection:**
   - Go to **Settings** (gear icon) → **Connections** → **OpenAI**
   - Click **"Add Connection"**
   - Configure:
     - **Name**: RAG Chatbot
     - **API Base URL**: `http://localhost:3000/v1`
     - **API Key**: `sk-webui-rag` (or any value - our API doesn't require real authentication)
   - Click **"Save"**

3. **Select the Model:**
   - In the chat interface, click the model selector
   - Select **"rag-llama3"** (our custom RAG model)

### 4. Add Knowledge Base Content

Before chatting, add content to Qdrant:

```bash
curl -X POST http://localhost:3000/text/submit \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text content here...",
    "metadata": {
      "title": "Document Title",
      "author": "Author Name"
    }
  }'
```

### 5. Start Chatting!

1. Open Open WebUI at `http://localhost:3080`
2. Make sure you've selected the **"rag-llama3"** model
3. Ask questions about your knowledge base content
4. The system will retrieve relevant context from Qdrant and generate answers

## Advantages Over LibreChat

✅ **Simpler Setup** - No MongoDB required  
✅ **Ollama-Native** - Designed specifically for Ollama  
✅ **Faster** - Less overhead, faster response times  
✅ **Better Timeout Handling** - More tolerant of longer responses  
✅ **Privacy-First** - All data stays local  
✅ **Easier Configuration** - Straightforward UI-based setup  

## Configuration Details

### Environment Variables

**Open WebUI:**
- `OPENAI_API_BASE_URL=http://nestjs-api:3000/v1` - Points to our RAG endpoint
- `OPENAI_API_KEY=sk-webui-rag` - API key (can be any value)
- `DEFAULT_MODELS=rag-llama3` - Default model to use
- `WEBUI_SECRET_KEY` - Secret for session management

**NestJS API:**
- `OLLAMA_API_URL=http://ollama:11434/v1`
- `QDRANT_URL=http://qdrant:6333`
- `OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest`
- `OLLAMA_CHAT_MODEL=llama3:8b`

## Troubleshooting

### Open WebUI Can't Connect to RAG Endpoint

1. Verify NestJS API is running:
   ```bash
   curl http://localhost:3000/health
   ```

2. Test OpenAI endpoint:
   ```bash
   curl http://localhost:3000/v1/models
   ```

3. Check Open WebUI logs:
   ```bash
   docker-compose logs open-webui
   ```

### Model Not Available

1. Make sure you've added the OpenAI connection in Open WebUI settings
2. Verify the model is listed:
   ```bash
   curl http://localhost:3000/v1/models
   ```
3. Refresh the model list in Open WebUI (Settings → Connections → Refresh)

### Empty Responses

1. Check NestJS logs for errors:
   ```bash
   docker-compose logs -f nestjs-api
   ```

2. Verify content exists in Qdrant:
   ```bash
   curl http://localhost:3000/text
   ```

3. Add test content:
   ```bash
   curl -X POST http://localhost:3000/text/submit \
     -H "Content-Type: application/json" \
     -d '{"text": "Test content for RAG system"}'
   ```

## Features

- **Conversation History** - All chats are saved locally
- **Multiple Models** - Switch between different models
- **Markdown Support** - Rich text rendering
- **Export Conversations** - Download chat history
- **Custom Prompts** - Create and save custom prompts
- **No Registration Required** - Simple setup, first user is admin

## Next Steps

- Add more content to your knowledge base
- Experiment with different models (switch `OLLAMA_CHAT_MODEL` in docker-compose.yml)
- Customize the UI appearance in Open WebUI settings

