# Conversational Agent Service

A standalone Node.js conversational agent with intelligent RAG decision-making, self-reflection, and comprehensive logging.

## Features

- **Intelligent Decision Making**: Uses LLM to decide when to use RAG vs direct answers
- **Dual Response Modes**: RAG-enhanced or direct responses based on query analysis
- **Self-Reflection**: Evaluates every response for accuracy, relevance, and clarity
- **Rich Logging**: Comprehensive logging with Winston (console + file)
- **Performance Metrics**: Tracks response times, success rates, and quality scores
- **Terminal Interface**: Beautiful CLI with colors and formatted output

## Prerequisites

- Node.js 18+ and npm
- LM Studio running on http://localhost:1234
- NestJS RAG API running on http://localhost:3000

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and adjust as needed:

```bash
cp env.example .env
```

Environment variables:

```env
# LM Studio Configuration
LM_STUDIO_API_URL=http://localhost:1234/v1
LM_STUDIO_CHAT_MODEL=google/gemma-3n-e4b
LM_STUDIO_TIMEOUT_SECONDS=600

# NestJS RAG API Configuration
RAG_API_URL=http://localhost:3000
RAG_API_ENDPOINT=/chat

# Agent Configuration
AGENT_NAME=Conversational Agent
AGENT_DESCRIPTION=An intelligent agent that can answer questions using RAG or direct knowledge
LOG_LEVEL=info
LOG_DIR=./logs
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Architecture

```
┌─────────────────────────────────────┐
│   Conversational Agent Service      │
│                                     │
│  ┌──────────────────────────────┐ │
│  │  Terminal CLI Interface      │ │
│  └──────────┬───────────────────┘ │
│             │                      │
│  ┌──────────▼───────────────────┐ │
│  │  Agent Core                  │ │
│  │  - Decision Engine (LLM)     │ │
│  │  - Response Generator        │ │
│  │  - Reflection Engine (LLM)   │ │
│  │  - Metrics Tracker           │ │
│  └──────────┬───────────────────┘ │
│             │                      │
│  ┌──────────▼───────────────────┐ │
│  │  Clients                     │ │
│  │  - RAG Client (NestJS API)   │ │
│  │  - LM Studio Client          │ │
│  └──────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Components

### 1. Agent Core (`src/agent/agent.ts`)
Main orchestrator that coordinates all components.

### 2. Decision Engine (`src/agent/decision-engine.ts`)
Uses LLM to decide whether to use RAG or direct answers based on query analysis.

### 3. Response Generator (`src/agent/response-generator.ts`)
Generates responses using either RAG (via NestJS API) or direct LLM calls.

### 4. Reflection Engine (`src/agent/reflection-engine.ts`)
Evaluates response quality using LLM, providing scores for accuracy, relevance, and clarity.

### 5. Metrics Tracker (`src/agent/metrics.ts`)
Tracks performance metrics including response times, method usage, and quality scores.

### 6. Terminal Interface (`src/cli/terminal.ts`)
Interactive CLI with colors, formatting, and command support.

### 7. Clients
- **LM Studio Client**: Direct API calls to LM Studio for chat, decisions, and reflections
- **RAG Client**: HTTP client for NestJS RAG API

## Available Commands

In the terminal interface:

- `/help` - Show available commands
- `/describe` - Show agent capabilities
- `/metrics` - Display performance metrics
- `/clear` - Clear conversation history
- `/exit` or `/quit` - Exit the agent

## Workflow

For each user query:

1. **Decision Phase**: LLM analyzes query to determine if RAG is needed
2. **Response Phase**: Generate answer using RAG or direct method
3. **Reflection Phase**: LLM evaluates response quality (accuracy, relevance, clarity)
4. **Metrics Phase**: Record performance data

## Logging

Logs are written to:
- Console: Colored, formatted output
- `logs/agent.log`: All logs in JSON format
- `logs/error.log`: Error logs only

Log levels: `error`, `warn`, `info`, `debug`

## Example Session

```
You: What is a vector database?

[1/4] Making decision...
  → Decision: RAG (confidence: 0.95)
  → Reason: Query asks about specific technical concept

[2/4] Generating response...
  → Response generated (458 chars)

[3/4] Performing self-reflection...
  → Reflection complete (overall: 0.89)

============================================================
Agent:
A vector database is a database specifically designed to store
and manage vector embeddings...
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

## Testing

Individual components can be tested:

```bash
# Test logger
npx ts-node src/test-logger.ts

# Test LM Studio client
npx ts-node src/test-lmstudio.ts

# Test RAG client
npx ts-node src/test-rag.ts
```

## Requirements Summary

✅ **Data Preparation & Contextualization**: Uses NestJS RAG API with Qdrant vector store

✅ **RAG Pipeline Design**: Integrates with existing embeddings + vector store via HTTP API

✅ **Reasoning & Reflection**: LLM-based decision engine and reflection engine

✅ **Tool-Calling Mechanisms**: RAG client for knowledge base access

✅ **Evaluation**: Comprehensive metrics tracking and reflection scores

✅ **Rich Logs**: Winston logger with console and file transports, structured logging

## License

MIT

