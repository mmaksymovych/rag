# SCA Agent

Software Composition Analysis (SCA) agent using LangChain for vulnerability analysis.

## Configuration

The agent supports both **Ollama** and **OpenAI-compatible APIs** (like LM Studio). Use environment variables to configure:

### For Ollama:
- `OLLAMA_API_URL`: URL where Ollama is running (default: `http://localhost:11434`)
- `OLLAMA_CHAT_MODEL`: Model name to use (default: `llama3:8b`)

### For LM Studio / OpenAI-compatible APIs:
- `LLM_API_URL`: API URL (default: `http://localhost:1234/v1` for LM Studio)
- `LLM_MODEL`: Model name (e.g., `gemma-2-2b-it`, `gemma-2-9b-it`)
- `USE_OPENAI_API`: Set to `true` to force OpenAI-compatible mode

**Note:** The tools automatically detect LM Studio if the URL contains `localhost:1234` or `/v1`.

### Examples

**Using LM Studio with Gemma:**
```bash
export LLM_API_URL=http://localhost:1234/v1
export LLM_MODEL=gemma-2-2b-it
# or
export USE_OPENAI_API=true
export LLM_API_URL=http://localhost:1234/v1
export LLM_MODEL=gemma-2-9b-it
```

**Using Ollama:**
```bash
export OLLAMA_API_URL=http://localhost:11434
export OLLAMA_CHAT_MODEL=gemma:7b
```

### Using .env file

Create a `.env` file in the `sca-agent` directory:

**For LM Studio:**
```env
LLM_API_URL=http://localhost:1234/v1
LLM_MODEL=google/gemma-3-12b
```

**For Ollama:**
```env
OLLAMA_API_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3:8b
```

## Quick Start

### Prerequisites

1. **LM Studio** - Running with Gemma model loaded (port 1234)
2. **RAG API** - Start with: `cd .. && docker-compose up nestjs-api`

### Start Services

**Using Docker (Recommended):**
```bash
# Start SCA Agent and dependencies
npm run docker:up

# Or start full stack (includes RAG API, Qdrant, Ollama)
npm run docker:full
```

**Manual Start:**
```bash
# Start SCA Agent API server
npm run dev

# Or using Docker
docker-compose up -d
```

## Running the API Server

Start the SCA Agent API server:

```bash
# Using .env file (recommended)
npm run dev

# Or with environment variables
export LLM_API_URL=http://localhost:1234/v1
export LLM_MODEL=google/gemma-3-12b
export RAG_API_URL=http://localhost:3000
export PORT=4000
npm run dev
```

### API Endpoints

- **GET /health** - Health check
- **POST /sca/scan** - Run SCA scan

#### Scan Request Example

```bash
curl -X POST http://localhost:4000/sca/scan \
  -H "Content-Type: application/json" \
  -d '{
    "forumUrls": ["http://localhost:3001/article/vulnerability"],
    "projectPath": "/path/to/your/project"
  }'
```

#### Scan Response

```json
{
  "success": true,
  "result": {
    "vulnerabilities": [...],
    "matches": [...],
    "report": {
      "scanDate": "2024-01-15T10:00:00Z",
      "totalVulnerabilitiesFound": 1,
      "vulnerablePackagesInProject": 1,
      "severityBreakdown": {
        "critical": 0,
        "high": 1,
        "medium": 0,
        "low": 0
      },
      "recommendations": ["Update lodash from 4.17.15 to >=4.17.21"],
      "summary": "..."
    }
  },
  "duration": "5000ms"
}
```

