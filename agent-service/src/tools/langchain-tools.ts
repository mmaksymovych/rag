import { z } from 'zod';
import { fileAnalyzer } from './file-analyzer';
import { ragClient } from '../clients/rag-client';
import { lmStudioClient } from '../clients/lmstudio-client';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('LangChainTools');

// Lazy load and create tools
let allToolsCache: any[] | null = null;

/**
 * Get all LangChain tools (lazy loaded)
 */
export function getAllTools(): any[] {
  if (allToolsCache !== null) {
    return allToolsCache;
  }

  try {
    const { DynamicStructuredTool } = require('@langchain/core/tools');
    
    const tools = [
      new DynamicStructuredTool({
        name: 'analyze_file',
        description: 'Analyze a file and upload its content to the RAG knowledge base. Supports text files (.txt, .md, .js, .ts, .json, .py, etc.) and PDF files. Use this when the user asks to analyze, process, or add a specific file to the knowledge base.',
        schema: z.object({
          filePath: z.string().describe('The absolute or relative path to the file to analyze'),
        }),
        func: async ({ filePath }: { filePath: string }) => {
          logger.info('Executing analyze_file tool', { filePath });
          try {
            const result = await fileAnalyzer.analyzeFile(filePath);
            if (result.success) {
              return JSON.stringify({
                success: true,
                message: `Successfully analyzed ${result.filename}`,
                sourceId: result.sourceId,
                chunks: result.chunks,
                textLength: result.textLength,
              });
            } else {
              return JSON.stringify({ success: false, message: result.message });
            }
          } catch (error: any) {
            logger.error('analyze_file tool failed', { error: error.message });
            return JSON.stringify({ success: false, message: `Failed to analyze file: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'analyze_directory',
        description: 'Analyze all supported files in a directory and upload them to the RAG knowledge base. Supports recursive analysis. Use this when the user asks to analyze a folder, directory, or multiple files at once.',
        schema: z.object({
          directoryPath: z.string().describe('The absolute or relative path to the directory to analyze'),
          recursive: z.boolean().optional().describe('Whether to analyze subdirectories recursively (default: true)'),
        }),
        func: async ({ directoryPath, recursive = true }: { directoryPath: string; recursive?: boolean }) => {
          logger.info('Executing analyze_directory tool', { directoryPath, recursive });
          try {
            const result = await fileAnalyzer.analyzeDirectory(directoryPath, { recursive });
            return JSON.stringify({
              success: true,
              message: result.summary,
              totalFiles: result.totalFiles,
              processedFiles: result.processedFiles,
              failedFiles: result.failedFiles,
            });
          } catch (error: any) {
            logger.error('analyze_directory tool failed', { error: error.message });
            return JSON.stringify({ success: false, message: `Failed to analyze directory: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'analyze_self',
        description: `Analyze the agent's own source code repository and upload it to the RAG knowledge base. 
        
This tool will:
- Scan all TypeScript, JavaScript, JSON, Markdown, and configuration files
- Exclude node_modules, dist, build, logs, and other generated files
- Upload all code to the knowledge base for querying
- Provide detailed statistics about the analysis

Use this when:
- User asks "analyze your code" or "tell me about your implementation"
- User wants to understand how the agent works
- User asks questions about the agent's architecture or components
- User wants to query the agent's own codebase

After analysis, you can use query_knowledge_base to answer questions about the code.`,
        schema: z.object({}),
        func: async () => {
          logger.info('Executing analyze_self tool');
          try {
            const result = await fileAnalyzer.analyzeSelf();
            
            // Create detailed summary
            const summary = {
              success: true,
              message: `Successfully analyzed agent repository: ${result.summary}`,
              totalFiles: result.totalFiles,
              processedFiles: result.processedFiles,
              failedFiles: result.failedFiles,
              details: {
                successful: result.results.filter(r => r.success).map(r => ({
                  filename: r.filename,
                  chunks: r.chunks,
                  textLength: r.textLength,
                })),
                failed: result.results.filter(r => !r.success).map(r => ({
                  filename: r.filename,
                  error: r.message,
                })),
              },
            };
            
            return JSON.stringify(summary, null, 2);
          } catch (error: any) {
            logger.error('analyze_self tool failed', { error: error.message });
            return JSON.stringify({ 
              success: false, 
              message: `Failed to analyze agent repository: ${error.message}` 
            });
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'query_knowledge_base',
        description: `Query the RAG knowledge base to retrieve relevant information from previously analyzed documents or code.
        
Use this tool when:
- The question is about specific documents, files, or code that has been analyzed
- The question requires information from the knowledge base
- The question asks "what does X say about Y" or "what is in the document about Z"
- You need factual information from uploaded content

Do NOT use this for:
- General knowledge questions (use direct_llm_response instead)
- Questions about the agent itself (unless code has been analyzed)
- Simple greetings or meta questions`,
        schema: z.object({
          query: z.string().describe('The question or search query'),
          topK: z.number().optional().describe('Number of relevant chunks to retrieve (default: 5)'),
        }),
        func: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
          logger.info('Executing query_knowledge_base tool', { query, topK });
          try {
            const result = await ragClient.queryRAG(query, topK);
            return JSON.stringify({
              success: true,
              answer: result.response,
              sources: result.sources,
              contextCount: result.context.length,
            });
          } catch (error: any) {
            logger.error('query_knowledge_base tool failed', { error: error.message });
            return JSON.stringify({ success: false, message: `Failed to query knowledge base: ${error.message}` });
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'direct_llm_response',
        description: `Generate a direct response using the LLM without querying the knowledge base.
        
Use this tool when:
- The question is general knowledge (e.g., "What is the capital of France?")
- The question is a greeting or meta question about the agent
- The question doesn't require information from analyzed documents
- The question is about general concepts, definitions, or explanations

Do NOT use this for:
- Questions about specific documents or analyzed content (use query_knowledge_base)
- Questions requiring information from uploaded files (use query_knowledge_base)`,
        schema: z.object({
          query: z.string().describe('The user\'s question or query'),
          context: z.string().optional().describe('Optional context or conversation history'),
        }),
        func: async ({ query, context }: { query: string; context?: string }) => {
          logger.info('Executing direct_llm_response tool', { query, hasContext: !!context });
          try {
            const messages: any[] = [
              {
                role: 'system',
                content: 'You are a helpful AI assistant. Provide clear, concise, and accurate answers.',
              },
            ];

            if (context) {
              messages.push({
                role: 'system',
                content: `Context: ${context}`,
              });
            }

            messages.push({
              role: 'user',
              content: query,
            });

            const response = await lmStudioClient.chatCompletion(messages);
            
            return JSON.stringify({
              success: true,
              answer: response,
            });
          } catch (error: any) {
            logger.error('direct_llm_response tool failed', { error: error.message });
            return JSON.stringify({ success: false, message: `Failed to generate response: ${error.message}` });
          }
        },
      }),
    ];

    allToolsCache = tools;
    logger.info('LangChain tools created', { toolCount: tools.length });
    return tools;
  } catch (error: any) {
    logger.warn('LangChain tools not available', { error: error.message });
    allToolsCache = [];
    return [];
  }
}

// Export for backward compatibility
export const allTools = getAllTools();
