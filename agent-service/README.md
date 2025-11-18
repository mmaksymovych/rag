# ReAct Agent Service

An intelligent conversational agent with ReAct (Reasoning + Acting) architecture, featuring intelligent routing, RAG integration, self-reflection, and self-improvement capabilities.

## Technologies Used

### Core Technologies
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **LangChain.js** - LLM orchestration and prompt management

### AI/ML Stack
- **LM Studio** - Local LLM inference server
  - Chat models: `openai/gpt-oss-20b`, `google/gemma-3-12b`
  - Embedding model: `nomic-embed-text-v1.5`
- **Qdrant** - Vector database for embeddings storage
- **RAG (Retrieval-Augmented Generation)** - Knowledge base integration

### Backend Services
- **NestJS** - Backend API framework for RAG processing
- **Docker** - Containerization for NestJS API and Qdrant
- **Axios** - HTTP client for API communication

### Libraries & Tools
- **Winston** - Structured logging (file-based)
- **Chalk** - Terminal styling and colors
- **Ora** - Terminal loading spinners
- **Readline** - Interactive CLI interface

### Architecture Patterns
- **ReAct Pattern** - Reasoning + Acting with iterative tool usage
- **Self-Reflection** - LLM-based quality evaluation
- **Self-Improvement** - Iterative answer refinement
- **Intelligent Routing** - Dynamic decision-making for query handling

## Features

- **🧠 ReAct Architecture**: Combines reasoning and acting with iterative tool usage
- **🎯 Intelligent Routing**: Automatically decides between direct LLM, tools, or RAG
- **🔍 Self-Reflection**: Evaluates answer quality (accuracy, relevance, clarity, completeness)
- **✨ Self-Improvement**: Iteratively improves answers that don't meet quality thresholds
- **🛠️ Multiple Tools**:
  - Weather information
  - Project codebase analysis
  - RAG knowledge base queries
- **📊 Quality Metrics**: Visual progress bars and detailed evaluation scores
- **🎨 Clean Terminal UI**: Matrix-style green output with minimal technical logs

## Prerequisites

### 1. LM Studio (Required)

**Download and Install:**
- Download from: https://lmstudio.ai/
- Install and launch LM Studio

**Required Models:**
You need to download and load these models in LM Studio:

1. **Chat Model** (for agent reasoning and responses):
   - Model: `openai/gpt-oss-20b` or `google/gemma-3-12b`
   - Download via LM Studio's model browser
   - Load the model in LM Studio

2. **Embedding Model** (for RAG vector search):
   - Model: `nomic-ai/nomic-embed-text-v1.5-GGUF`
   - Download via LM Studio's model browser
   - This is used by the NestJS API for embeddings

**Start LM Studio Server:**
1. In LM Studio, go to "Local Server" tab
2. Load your chat model
3. Click "Start Server"
4. Verify it's running on `http://localhost:1234`

### 2. Docker (Required for NestJS API and Qdrant)

**Install Docker:**
- Download from: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop

### 3. Node.js (Required)

- Node.js 18+ and npm
- Download from: https://nodejs.org/

## Setup Instructions

### Step 1: Start Backend Services (Docker)

From the **root project directory** (not agent-service):

```bash
# Start NestJS API and Qdrant vector database
docker-compose up -d nestjs-api qdrant

# Verify services are running
docker ps

# You should see:
# - rag-nestjs-api-1 (port 3000)
# - qdrant (port 6333)
```

**What this starts:**
- **NestJS API** (`http://localhost:3000`): RAG processing, embeddings, vector search
- **Qdrant** (`http://localhost:6333`): Vector database for storing embeddings

### Step 2: Install Agent Dependencies

```bash
cd agent-service
npm install
```

### Step 3: Configure Environment

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` if needed (defaults should work):

```env
# LM Studio Configuration
LM_STUDIO_API_URL=http://localhost:1234/v1
LM_STUDIO_CHAT_MODEL=openai/gpt-oss-20b
LM_STUDIO_TIMEOUT_SECONDS=600

# NestJS RAG API Configuration
RAG_API_URL=http://localhost:3000
RAG_API_ENDPOINT=/chat

# Agent Configuration
AGENT_NAME=ReAct Agent
AGENT_DESCRIPTION=An intelligent ReAct-style agent with routing, reflection, and self-improvement
LOG_LEVEL=info
LOG_DIR=./logs
```

### Step 4: Build and Start the Agent

```bash
# Build TypeScript
npm run build

# Start the agent
npm start
```

You should see:

```
╔══════════════════════════════════════════════════════════╗
║                    REACT AGENT                           ║
╚══════════════════════════════════════════════════════════╝

Welcome to the ReAct Agent!
A simple agent that uses tools to answer questions.

Quick Commands:
  /help     - Show all commands
  /describe - Agent description
  /exit     - Exit agent

Type your question and press Enter.

You: 
```

## Usage

### Available Commands

- `/help` - Show all available commands
- `/describe` - Show agent capabilities and workflow
- `/exit` or `/quit` - Exit the agent

### Example Queries

**General Questions (Direct LLM):**
```
You: Hello, how are you?
You: What is 2+2?
You: Explain what machine learning is
```

**Weather Queries (Tool: getWeather):**
```
You: What's the weather in London?
You: Tell me the weather in New York
```

**Project Analysis (Tool: analyzeProject):**
```
You: Analyze this project
You: What is the architecture of this codebase?
You: Explain the project structure
```

**RAG Queries (Tool: queryRAG):**
```
You: What are RAG databases?
You: Explain vector embeddings
You: What is Qdrant?
```

### Understanding the Output

After each query, you'll see:

1. **📋 Reasoning**: How the agent decided to handle your query
2. **Agent Answer**: The response in green (Matrix style)
3. **🔍 Self-Evaluation**: Quality scores with visual progress bars
4. **⏱️ Response Time**: Total processing time

Example:

```
📋 Reasoning:
  Decision: ReAct with Tools
  Reason: Query requires weather information

Agent: The weather in London is currently 15°C with partly cloudy skies...

────────────────────────────────────────────────────────────

🔍 Self-Evaluation:
  Quality Scores:
    Accuracy:     ██████████ 95%
    Relevance:    █████████░ 90%
    Clarity:      ████████░░ 85%
    Completeness: █████████░ 90%
    Overall:      90.0%

  Feedback: Answer is accurate, relevant, and well-structured.

⏱️  Response time: 3245ms
────────────────────────────────────────────────────────────
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ReAct Agent Service                   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Terminal CLI (Matrix-style green output)         │ │
│  └─────────────────────┬─────────────────────────────┘ │
│                        │                                │
│  ┌─────────────────────▼─────────────────────────────┐ │
│  │  Agent Core (Orchestrator)                        │ │
│  │  - Intelligent Routing (Decision Service)         │ │
│  │  - Self-Reflection (Reflection Service)           │ │
│  │  - Self-Improvement Loop                          │ │
│  └─────────────────────┬─────────────────────────────┘ │
│                        │                                │
│  ┌─────────────────────▼─────────────────────────────┐ │
│  │  ReAct Agent (Reasoning + Acting)                 │ │
│  │  - Iterative Thought/Action/Observation loop      │ │
│  │  - Tool selection and execution                   │ │
│  │  - Response parsing and validation                │ │
│  └─────────────────────┬─────────────────────────────┘ │
│                        │                                │
│  ┌─────────────────────▼─────────────────────────────┐ │
│  │  Tools                                            │ │
│  │  - getWeather: Weather information                │ │
│  │  - analyzeProject: Codebase analysis              │ │
│  │  - queryRAG: Knowledge base queries               │ │
│  └─────────────────────┬─────────────────────────────┘ │
│                        │                                │
│  ┌─────────────────────▼─────────────────────────────┐ │
│  │  External Services                                │ │
│  │  - LM Studio (Chat & Embeddings)                  │ │
│  │  - NestJS RAG API (Vector Search)                 │ │
│  │  - Qdrant (Vector Database)                       │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Agent Workflow

For each user query:

1. **Intelligent Routing**: Decide between direct LLM, tools, or RAG
2. **Answer Generation**:
   - **Direct LLM**: Simple questions, greetings
   - **ReAct with Tools**: Weather, project analysis, RAG queries
3. **Self-Reflection**: Evaluate answer quality (4 dimensions + overall)
4. **Self-Improvement**: If quality < 75%, iteratively improve (up to 2 iterations)

### ReAct Loop (When Using Tools)

```
User Query → Agent decides to use tools

Iteration 1:
  Thought: "I need weather information"
  Action: getWeather
  Action Input: {"city": "London"}
  → System provides Observation (tool result)

Iteration 2:
  Thought: "I have the weather data"
  Final Answer: "The weather in London is..."
```

## Logging

All technical logs are written to files only (no console clutter):

- `logs/agent.log`: All logs in JSON format
- `logs/error.log`: Error logs only

Log levels: `error`, `warn`, `info`, `debug`

## Troubleshooting

### LM Studio Connection Issues

**Problem**: `LM Studio API not responding`

**Solutions**:
1. Verify LM Studio is running: Open LM Studio app
2. Check server is started: Go to "Local Server" tab, click "Start Server"
3. Verify model is loaded: You should see a model loaded in the server tab
4. Test connection: `curl http://localhost:1234/v1/models`

### RAG API 404 Error

**Problem**: `RAG API error (404): Not Found`

**Solutions**:
1. Check Docker containers are running:
   ```bash
   docker ps | grep nestjs
   ```
2. Check port 3000 is not used by another process:
   ```bash
   lsof -i :3000
   ```
3. Restart NestJS API:
   ```bash
   docker-compose restart nestjs-api
   ```
4. Check logs:
   ```bash
   docker logs rag-nestjs-api-1 --tail 50
   ```

### Agent Infinite Loop

**Problem**: Agent keeps calling the same tool repeatedly

**Solutions**:
1. This is usually an LLM model issue
2. Try a different model in LM Studio (e.g., switch between `openai/gpt-oss-20b` and `google/gemma-3-12b`)
3. Update `LM_STUDIO_CHAT_MODEL` in `.env`
4. Restart the agent

### Port Conflicts

**Problem**: Port 3000 or 1234 already in use

**Solutions**:
1. Find the process using the port:
   ```bash
   lsof -i :3000
   lsof -i :1234
   ```
2. Kill the conflicting process:
   ```bash
   kill <PID>
   ```
3. Or change ports in `.env` and `docker-compose.yml`

## Development

### Project Structure

```
agent-service/
├── src/
│   ├── agent/
│   │   ├── agent.ts              # Main orchestrator
│   │   └── react-agent.ts        # ReAct loop implementation
│   ├── services/
│   │   ├── decision-service.ts   # Intelligent routing
│   │   └── reflection-service.ts # Self-reflection & improvement
│   ├── tools/
│   │   ├── weather-tool.ts       # Weather information
│   │   ├── analyze-project-tool.ts # Codebase analysis
│   │   ├── rag-tool.ts           # RAG queries
│   │   └── index.ts              # Tool registry
│   ├── clients/
│   │   ├── lmstudio-client.ts    # LM Studio API client
│   │   └── rag-client.ts         # NestJS RAG API client
│   ├── cli/
│   │   └── terminal.ts           # Terminal interface
│   ├── utils/
│   │   ├── config.ts             # Configuration
│   │   └── logger.ts             # Winston logger
│   └── index.ts                  # Entry point
├── logs/                         # Log files
├── .env                          # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

### Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Adding New Tools

1. Create a new tool file in `src/tools/`:

```typescript
// src/tools/my-tool.ts
export const myTool = {
  name: 'myTool',
  description: 'Description of what the tool does',
  execute: async (input: any) => {
    // Tool implementation
    return 'Tool result';
  },
};
```

2. Register the tool in `src/tools/index.ts`:

```typescript
import { myTool } from './my-tool';

export const reactTools = {
  getWeather: weatherTool.execute,
  analyzeProject: analyzeProjectTool.execute,
  queryRAG: ragTool.execute,
  myTool: myTool.execute, // Add your tool
};
```

3. Update `getToolDescriptions()` to include the new tool description.

## Requirements Summary

✅ **ReAct Architecture**: Iterative reasoning and acting with tool usage

✅ **Intelligent Routing**: LLM-based decision making for query handling

✅ **RAG Integration**: Queries NestJS API with Qdrant vector store

✅ **Self-Reflection**: LLM evaluates answer quality across 4 dimensions

✅ **Self-Improvement**: Iterative improvement loop for low-quality answers

✅ **Multiple Tools**: Weather, project analysis, RAG knowledge base

✅ **Rich Logging**: File-based structured logging (Winston)

✅ **Clean UI**: Matrix-style terminal with visual quality metrics

## License

MIT
