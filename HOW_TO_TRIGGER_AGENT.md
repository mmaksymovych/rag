# How to Trigger the Test Generation Agent

## Quick Start

The agent flow is triggered via a **POST** request to the `/agent/generate-tests` endpoint.

## Prerequisites

Make sure all services are running:

1. **OpenAPI Project** (port 3001) - The API being tested
2. **RAG API** (port 3000) - For querying existing tests
3. **Test Agent** (port 3002) - The agent service

## Trigger Methods

### Method 1: Using cURL

```bash
curl -X POST http://localhost:3002/agent/generate-tests
```

### Method 2: Using cURL with JSON Output

```bash
curl -X POST http://localhost:3002/agent/generate-tests | jq .
```

### Method 3: Using HTTPie

```bash
http POST http://localhost:3002/agent/generate-tests
```

### Method 4: Using Postman/Insomnia

- **Method**: POST
- **URL**: `http://localhost:3002/agent/generate-tests`
- **Headers**: `Content-Type: application/json` (optional)
- **Body**: None required

### Method 5: Using JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3002/agent/generate-tests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
});

const result = await response.json();
console.log(result);
```

### Method 6: Using Python

```python
import requests

response = requests.post('http://localhost:3002/agent/generate-tests')
result = response.json()
print(result)
```

## Expected Response

The agent returns a `GenerationResult` object:

```json
{
  "success": true,
  "message": "Generated 2/3 stable tests successfully",
  "generatedTests": [
    {
      "endpoint": "/users",
      "method": "GET",
      "fileName": "users.e2e-spec.ts",
      "filePath": "/path/to/e2e-tests/tests/users.e2e-spec.ts",
      "testGenerated": true,
      "testPassed": true,
      "isStable": true,
      "stabilityRuns": 3,
      "totalAttempts": 1
    }
  ],
  "errors": []
}
```

## What Happens When You Trigger

1. **Verifies OpenAPI server** is running (http://localhost:3001)
2. **Fetches OpenAPI spec** from http://localhost:3001/api-docs-json
3. **Queries RAG system** for existing test patterns and examples
4. **Analyzes gaps** to find missing tests using LLM
5. **Prepares and enriches data** with context
6. **Generates tests** for missing endpoints using LLM
7. **Writes test files** to e2e-tests repository
8. **Runs tests** to verify they work
9. **Verifies stability** (runs each test 3 times)
10. **Auto-fixes** non-deterministic tests if needed
11. **Adds successful tests** to RAG system

## Monitoring Progress

The agent logs all steps. To see logs:

```bash
# If running in terminal
# Logs will appear in the console

# If running as background process
tail -f /tmp/test-agent.log
```

## Example Full Workflow

```bash
# 1. Check all services are running
curl http://localhost:3001/health  # OpenAPI Project
curl http://localhost:3000/health  # RAG API
curl http://localhost:3002/agent/health  # Test Agent

# 2. Trigger the agent
curl -X POST http://localhost:3002/agent/generate-tests | jq .

# 3. Check generated tests
ls -la ../e2e-tests/tests/

# 4. Run e2e tests manually (optional)
cd ../e2e-tests && npm test
```

## Response Status Codes

- **200 OK**: Request processed successfully
- **500 Internal Server Error**: Something went wrong (check logs)

## Troubleshooting

### Agent not responding
```bash
# Check if agent is running
curl http://localhost:3002/agent/health

# If not running, start it
cd test-agent
PORT=3002 npm run start:dev
```

### OpenAPI server not accessible
```bash
# Check OpenAPI server
curl http://localhost:3001/health

# If using Docker
docker-compose ps openapi-project
```

### RAG API not accessible
```bash
# Check RAG API
curl http://localhost:3000/health

# If using Docker
docker-compose ps nestjs-api
```

## Environment Variables

The agent uses these environment variables (with defaults):

- `OPENAPI_PROJECT_URL` (default: `http://localhost:3001`)
- `OPENAPI_SPEC_URL` (default: `http://localhost:3001/api-docs-json`)
- `RAG_API_URL` (default: `http://localhost:3000`)
- `LM_STUDIO_API_URL` (default: `http://127.0.0.1:1234/v1`)
- `LM_STUDIO_MODEL` (default: `google/gemma-3n-e4b`)
- `E2E_TESTS_PATH` (default: `../e2e-tests`)
- `MAX_TEST_GENERATION_RETRIES` (default: `3`)

## Quick Test

```bash
# One-liner to trigger and see results
curl -X POST http://localhost:3002/agent/generate-tests | jq '.message, .generatedTests[] | {endpoint, method, isStable, testPassed}'
```

