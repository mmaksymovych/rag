# Repository Analysis Support

## Overview

The agent can now analyze its own source code repository and make it queryable through the RAG knowledge base. This enables the agent to answer questions about its own implementation, architecture, and codebase.

## Features

### ✅ Comprehensive File Support

The repository analysis supports:

**Code Files:**
- `.ts` - TypeScript source files
- `.js` - JavaScript files
- `.json` - Configuration and data files

**Documentation:**
- `.md` - Markdown documentation
- `.txt` - Text files
- `.rst` - reStructuredText

**Configuration:**
- `.yaml`, `.yml` - YAML config files
- `.toml` - TOML config files
- `.ini`, `.conf` - INI/Config files

### ✅ Smart Exclusions

Automatically excludes:
- `node_modules/` - Dependencies
- `dist/`, `build/` - Build outputs
- `logs/` - Log files
- `.git/` - Git repository data
- `.vscode/`, `.idea/` - IDE configs
- `coverage/`, `.nyc_output/` - Test coverage
- `*.log` - Log files
- `package-lock.json` - Too large, not useful

### ✅ Progress Reporting

- Real-time progress tracking during analysis
- Detailed logging for each file
- Success/failure statistics
- Chunk count reporting

### ✅ Detailed Results

Returns comprehensive information:
- Total files found
- Successfully processed files
- Failed files (with error messages)
- Total chunks created
- Per-file statistics

## Usage

### Automatic Detection

The agent automatically detects when you want to analyze the repository:

**Trigger Phrases:**
- "analyze your code"
- "analyze yourself"
- "tell me about your implementation"
- "how does your code work"
- "what's in your repository"

### Example Conversation

```
You: Analyze your own code and tell me about the agent implementation

[AUTONOMOUS MODE] Query requires tool usage...
  → Tools used: analyze_self, query_knowledge_base

Agent: I've analyzed my source code repository. Here's what I found:

My implementation consists of several key components:

1. **Agent Core** (`src/agent/agent.ts`)
   - Orchestrates the entire workflow
   - Manages conversation history
   - Coordinates decision, response, and reflection

2. **Self-Improvement Engine** (`src/agent/self-improvement-engine.ts`)
   - Iteratively refines answers
   - Evaluates quality on 3 dimensions
   - Continues until quality threshold is met

3. **Decision Engine** (`src/agent/decision-engine.ts`)
   - Uses LLM to decide RAG vs Direct
   - Analyzes query intent
   - Provides confidence scores

4. **LangChain Integration** (`src/agent/langchain-agent.ts`)
   - Enables autonomous tool usage
   - Handles file analysis commands
   - Manages tool execution

[Analysis Results]
- Total Files: 15
- Processed: 15
- Failed: 0
- Chunks Created: 127
```

### Querying Analyzed Code

After analysis, you can ask questions:

```
You: How does the self-improvement engine work?

Agent: Based on my codebase, the self-improvement engine works as follows:

1. **Initial Answer Generation**: First generates an answer using RAG or direct LLM
2. **Self-Assessment**: Evaluates the answer on three dimensions:
   - Accuracy (0-1): Factual correctness
   - Relevance (0-1): Addresses the question
   - Clarity (0-1): Well-structured and clear
3. **Quality Check**: Answer must achieve average score ≥ 0.85
4. **Iterative Refinement**: If not good enough:
   - Identifies specific issues
   - Creates improvement plan
   - Generates improved version
   - Re-evaluates (up to 3 iterations)
5. **Final Answer**: Returns the best version after iterations

The implementation is in `src/agent/self-improvement-engine.ts`...
```

## Technical Details

### Analysis Process

1. **File Discovery**
   - Recursively scans repository
   - Filters by extension
   - Excludes unwanted directories

2. **File Processing**
   - Reads file content
   - Submits to RAG API via `/text/submit`
   - Creates chunks with metadata

3. **Metadata Tracking**
   - Filename
   - File path
   - File type
   - Analysis timestamp
   - Source ID for tracking

4. **Vector Storage**
   - Chunks are embedded
   - Stored in Qdrant vector database
   - Indexed for semantic search

### Configuration Options

The `analyzeSelf()` method supports options:

```typescript
await fileAnalyzer.analyzeSelf({
  includeConfig: true,   // Include config files (default: true)
  includeTests: true,    // Include test files (default: true)
  includeDocs: true,     // Include documentation (default: true)
});
```

### Performance

- **Small repos** (< 50 files): ~10-30 seconds
- **Medium repos** (50-200 files): ~30-90 seconds
- **Large repos** (> 200 files): ~90+ seconds

Time depends on:
- Number of files
- File sizes
- RAG API processing speed
- Network latency

## Benefits

### 1. Self-Awareness
- Agent understands its own codebase
- Can explain its architecture
- Can answer implementation questions

### 2. Documentation
- Code becomes self-documenting
- Questions about implementation are answerable
- Architecture discussions are possible

### 3. Debugging Support
- Can explain how components work
- Can identify where features are implemented
- Can trace code flow

### 4. Learning
- Agent can learn from its own code
- Can suggest improvements
- Can explain design decisions

## Limitations

1. **Large Files**: Very large files may timeout
2. **Binary Files**: Only text-based files are supported
3. **Generated Code**: Excludes build outputs
4. **Real-time Updates**: Code changes require re-analysis

## Best Practices

1. **Analyze After Major Changes**: Re-analyze when codebase changes significantly
2. **Use Specific Questions**: More specific questions get better answers
3. **Combine with Context**: Use query_knowledge_base after analysis
4. **Check Logs**: Review logs for analysis progress and errors

## Troubleshooting

### Analysis Fails

**Check:**
- RAG API is running (`http://localhost:3000`)
- Files are readable
- No permission issues
- Sufficient disk space

### No Results Found

**Possible causes:**
- All files excluded
- Wrong directory
- No matching file extensions
- Files are empty

### Slow Analysis

**Optimize by:**
- Excluding more directories
- Reducing file count
- Using faster hardware
- Checking network speed

## Future Enhancements

Potential improvements:
- Incremental analysis (only changed files)
- Analysis caching
- Parallel file processing
- Progress bar in terminal
- Analysis scheduling
- Code change detection

## Conclusion

Repository analysis enables the agent to be self-aware and answer questions about its own implementation. This creates a powerful feedback loop where the agent can understand, explain, and improve its own codebase.

