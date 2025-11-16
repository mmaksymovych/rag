# Quick Start Guide

## Prerequisites

Before running the agent, ensure these services are running:

1. **LM Studio** on http://localhost:1234
   - Load a chat model (e.g., `google/gemma-3n-e4b`)
   - Ensure the server is started

2. **NestJS RAG API** on http://localhost:3000
   - Navigate to `../nestjs-api`
   - Run `docker-compose up -d` (for Qdrant)
   - Run `npm run start:dev`

## Installation

```bash
cd agent-service
npm install
```

## Running the Agent

### Development Mode (recommended)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## First Time Usage

1. Start the agent:
   ```bash
   npm run dev
   ```

2. You'll see a welcome screen with available commands

3. Try these example queries:
   - `Hello!` - Test greeting (DIRECT mode)
   - `What can you do?` - Agent description (DIRECT mode)
   - `What does the document say about embeddings?` - RAG query
   - `What is the capital of France?` - General knowledge (DIRECT mode)

4. After each response, you'll see:
   - The answer
   - Response time and method used
   - Reflection scores (accuracy, relevance, clarity)
   - Feedback and suggestions

## Available Commands

- `/help` - Show available commands
- `/describe` - Show agent capabilities
- `/metrics` - Display performance metrics
- `/clear` - Clear conversation history
- `/exit` or `/quit` - Exit the agent

## Example Session

```
You: What does the document say about vector databases?

[1/4] Making decision...
  → Decision: RAG (confidence: 0.95)
  → Reason: Query asks about specific document content

[2/4] Generating response...
  → Response generated (458 chars)

[3/4] Performing self-reflection...
  → Reflection complete (overall: 0.89)

============================================================
Agent:
Based on the context, a vector database is a database 
specifically designed to store and manage vector embeddings...
============================================================

[Response Time: 3866ms | Method: RAG]
[Sources: video_1763316450149_3s366zomx]

╔══════════════════════════════════════════════════════════╗
║                   REFLECTION SCORES                      ║
╠══════════════════════════════════════════════════════════╣
║ Accuracy:  0.92 █████████░                               ║
║ Relevance: 0.95 █████████░                               ║
║ Clarity:   0.80 ████████░░                               ║
╠══════════════════════════════════════════════════════════╣
║ Overall:   0.89 ████████░░                               ║
╚══════════════════════════════════════════════════════════╝
```

## Troubleshooting

### "Failed to connect to LM Studio"
- Ensure LM Studio is running
- Check that a model is loaded
- Verify the server is started on port 1234

### "Failed to connect to RAG API"
- Ensure NestJS API is running
- Check docker-compose services (Qdrant)
- Verify API is accessible at http://localhost:3000

### Slow responses
- Normal for first query (model loading)
- Subsequent queries should be faster
- RAG queries take longer due to vector search

## Logs

Logs are written to:
- Console: Real-time colored output
- `logs/agent.log`: All logs in JSON format
- `logs/error.log`: Error logs only

## Next Steps

- Upload documents to the RAG system via NestJS API
- Ask questions about your documents
- View metrics with `/metrics` command
- Check logs for detailed operation traces

