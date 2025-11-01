# RAG Chatbot System

A Retrieval-Augmented Generation (RAG) chatbot system built with NestJS, Ollama, and Qdrant.

## Architecture

- **NestJS API**: Text processing, chunking, embedding, and RAG chat service
- **Ollama**: Local LLM for embeddings and chat completions (OpenAI-compatible API)
- **Qdrant**: Vector database for semantic search
- **Open WebUI**: Simple, user-friendly web UI for chatting with the RAG system
- **Docker**: Containerization for all services

## Phase 1: Core Text Embeddings & RAG API

This phase implements the core functionality for text processing and RAG chat via REST API.

### Prerequisites

- Docker and Docker Compose
- NVIDIA GPU (recommended for Ollama)

### Quick Start

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

### API Endpoints

#### Text Processing
- `POST /text/submit` - Submit text for embedding
- `GET /text` - List stored text chunks
- `DELETE /text/:sourceId` - Remove text from vector DB

#### Chat
- `POST /chat` - RAG-enhanced chat (custom format)
- `POST /v1/chat/completions` - OpenAI-compatible endpoint for LibreChat
- `GET /v1/models` - OpenAI-compatible models list
- `GET /chat/models` - List available models

#### Health
- `GET /health` - Health check

### Configuration

Environment variables in `.env`:

```env
# Ollama Configuration
OLLAMA_API_URL=http://ollama:11434/v1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3:8b

# Qdrant Configuration
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION_NAME=text_chunks

# Text Processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=100
MAX_TEXT_LENGTH=100000
```

### Testing

1. **Submit test text:**
   ```bash
   curl -X POST http://localhost:3000/text/submit \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Artificial intelligence is a field of computer science that focuses on creating intelligent machines that can perform tasks that typically require human intelligence.",
       "metadata": {"title": "AI Introduction"}
     }'
   ```

2. **Test chat:**
   ```bash
   curl -X POST http://localhost:3000/chat \
     -H "Content-Type: application/json" \
     -d '{"query": "What is artificial intelligence?"}'
   ```

3. **Check health:**
   ```bash
   curl http://localhost:3000/health
   ```

### Development

To run in development mode:

```bash
cd nestjs-api
npm install
npm run start:dev
```

### Troubleshooting

1. **Ollama models not loading:**
   - Check Ollama logs: `docker-compose logs ollama`
   - Manually pull models: `docker exec -it rag-ollama-1 ollama pull nomic-embed-text`

2. **Qdrant connection issues:**
   - Check Qdrant logs: `docker-compose logs qdrant`
   - Verify Qdrant is accessible: `curl http://localhost:6333/health`

3. **NestJS API issues:**
   - Check API logs: `docker-compose logs nestjs-api`
   - Verify environment variables are set correctly

## Phase 2: Open WebUI Integration ✅

Open WebUI is now integrated and configured to use the RAG system. See [OPENWEBUI_SETUP.md](./OPENWEBUI_SETUP.md) for detailed setup and usage instructions.

**Quick Access:**
- Open WebUI: http://localhost:3080
- The system automatically uses Qdrant as the knowledge base for all chat queries

## Next Phases

- **Phase 3**: File Processing (PDF & Audio)

## License

MIT
