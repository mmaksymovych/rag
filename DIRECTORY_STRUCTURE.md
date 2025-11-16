# Agent Directory Structure

## Overview

Each service/tool is now organized into its own directory for better modularity and maintainability.

## Directory Structure

```
test-agent/src/agent/
├── agent/                          # Main orchestrator service
│   ├── agent.controller.ts         # API endpoints
│   ├── agent.module.ts            # NestJS module
│   └── agent.service.ts           # Main orchestration logic
│
├── openapi/                        # OpenAPI service
│   ├── openapi.service.ts         # OpenAPI spec fetching & parsing
│   └── openapi.service.spec.ts   # Unit tests
│
├── rag/                            # RAG service
│   ├── rag.service.ts             # RAG system integration
│   └── rag.service.spec.ts        # Unit tests
│
├── gap-analysis/                   # Gap analysis service
│   ├── gap-analysis.service.ts    # LLM-based gap analysis
│   └── gap-analysis.service.spec.ts # Unit tests
│
├── data-preparation/               # Data preparation service
│   └── data-preparation.service.ts # Data validation & enrichment
│
├── reflection/                     # Reflection service
│   └── reflection.service.ts      # Test failure analysis & retry logic
│
├── test-generator/                 # Test generator service
│   ├── test-generator.service.ts  # LLM-based test code generation
│   └── test-generator.service.spec.ts # Unit tests
│
├── test-runner/                    # Test runner service
│   └── test-runner.service.ts     # Test execution
│
└── file-writer/                    # File writer service
    └── file-writer.service.ts     # File writing & formatting
```

## Import Paths

All imports have been updated to use relative paths from the new structure:

### From Agent Service
```typescript
import { OpenApiService, EndpointInfo } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';
import { GapAnalysisService, MissingTest } from '../gap-analysis/gap-analysis.service';
import { DataPreparationService, PreparedContext } from '../data-preparation/data-preparation.service';
import { ReflectionService } from '../reflection/reflection.service';
import { TestGeneratorService } from '../test-generator/test-generator.service';
import { TestRunnerService, TestResult } from '../test-runner/test-runner.service';
import { FileWriterService } from '../file-writer/file-writer.service';
```

### From Other Services
```typescript
// Example: From gap-analysis service
import { OpenApiService, EndpointInfo } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';

// Example: From test-generator service
import { EndpointInfo } from '../openapi/openapi.service';
import { MissingTest } from '../gap-analysis/gap-analysis.service';
```

### From App Module
```typescript
import { AgentModule } from './agent/agent/agent.module';
```

## Benefits

1. **Modularity**: Each service is self-contained in its own directory
2. **Maintainability**: Easier to locate and modify specific services
3. **Scalability**: Easy to add new services or tools
4. **Organization**: Clear separation of concerns
5. **Testing**: Test files are co-located with their services

## Services Overview

| Service | Directory | Purpose |
|---------|-----------|---------|
| Agent | `agent/` | Main orchestration service |
| OpenAPI | `openapi/` | OpenAPI spec fetching & parsing |
| RAG | `rag/` | RAG system integration |
| Gap Analysis | `gap-analysis/` | LLM-based gap analysis |
| Data Preparation | `data-preparation/` | Data validation & enrichment |
| Reflection | `reflection/` | Test failure analysis & retry |
| Test Generator | `test-generator/` | LLM-based test generation |
| Test Runner | `test-runner/` | Test execution |
| File Writer | `file-writer/` | File writing & formatting |

## Verification

✅ Build successful: `npm run build`  
✅ Tests passing: `npm test`  
✅ All imports updated  
✅ Module structure maintained

