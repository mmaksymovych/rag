import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { VectorStoreService, SearchResult } from '../vector-store/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';

export interface ChatRequest {
    query: string;
    topK?: number;
}

export interface ChatResponse {
    response: string;
    context: SearchResult[];
    sources: string[];
}

@Injectable()
export class ChatService {
    private openai: OpenAI;

    constructor(
        private configService: ConfigService,
        private vectorStoreService: VectorStoreService,
        private embeddingService: EmbeddingService,
    ) {
        const ollamaApiUrl = this.configService.get<string>('OLLAMA_API_URL');

        this.openai = new OpenAI({
            baseURL: ollamaApiUrl,
            apiKey: 'ollama', // Ollama doesn't require a real API key
        });
    }

    /**
     * Process RAG chat request
     */
    async processChat(chatRequest: ChatRequest): Promise<ChatResponse> {
        const startTime = Date.now();
        const { query, topK = 5 } = chatRequest;
        
        console.log(`[ChatService] Processing RAG chat - Query length: ${query.length} chars, TopK: ${topK}`);
        
        try {
            // Generate embedding for the query
            console.log(`[ChatService] Step 1/4: Generating query embedding...`);
            const embeddingStart = Date.now();
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            const embeddingDuration = Date.now() - embeddingStart;
            console.log(`[ChatService] Query embedding generated in ${embeddingDuration}ms`);

            // Search for relevant chunks
            console.log(`[ChatService] Step 2/4: Searching vector store for top ${topK} results...`);
            const searchStart = Date.now();
            const searchResults = await this.vectorStoreService.semanticSearch(queryEmbedding, topK);
            const searchDuration = Date.now() - searchStart;
            console.log(`[ChatService] Vector search completed in ${searchDuration}ms, Found ${searchResults.length} results`);

            if (searchResults.length === 0) {
                const totalDuration = Date.now() - startTime;
                console.log(`[ChatService] No results found, returning empty response. Total duration: ${totalDuration}ms`);
                return {
                    response: "I don't have any relevant information to answer your question. Please add some text content first.",
                    context: [],
                    sources: []
                };
            }

            // Format context from search results
            const contextStart = Date.now();
            const context = searchResults.map(result => result.payload.text).join('\n\n');
            const sources = [...new Set(searchResults.map(result => result.payload.sourceId))];
            const contextLength = context.length;
            const contextDuration = Date.now() - contextStart;
            console.log(`[ChatService] Step 3/4: Formatted context - Length: ${contextLength} chars, Sources: [${sources.join(', ')}], Duration: ${contextDuration}ms`);

            // Create RAG prompt
            const prompt = this.createRAGPrompt(query, context);
            const promptLength = prompt.length;
            console.log(`[ChatService] Created RAG prompt - Length: ${promptLength} chars`);

            // Generate response using Ollama
            console.log(`[ChatService] Step 4/4: Generating LLM response...`);
            const llmStart = Date.now();
            const response = await this.generateResponse(prompt);
            const llmDuration = Date.now() - llmStart;
            const responseLength = response.length;
            console.log(`[ChatService] LLM response generated in ${llmDuration}ms - Response length: ${responseLength} chars`);

            const totalDuration = Date.now() - startTime;
            console.log(`[ChatService] RAG chat completed successfully - Total duration: ${totalDuration}ms (Embedding: ${embeddingDuration}ms, Search: ${searchDuration}ms, LLM: ${llmDuration}ms)`);

            return {
                response,
                context: searchResults,
                sources
            };
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[ChatService] Failed to process chat after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to process chat: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Create RAG prompt with context
     */
    private createRAGPrompt(query: string, context: string): string {
        return `Context:
${context}

Question: ${query}

Please answer the question based on the provided context. If the context doesn't contain enough information to answer the question, please say so. Keep your answer concise and relevant.

Answer:`;
    }

    /**
     * Generate response using Ollama
     */
    private async generateResponse(prompt: string): Promise<string> {
        const startTime = Date.now();
        const modelName = this.configService.get<string>('OLLAMA_CHAT_MODEL', 'llama3:8b');
        const promptLength = prompt.length;
        
        // Get timeout from config (in seconds), default to 10 minutes (600s), 0 means no timeout
        const timeoutSeconds = parseInt(this.configService.get<string>('OLLAMA_TIMEOUT_SECONDS', '600'), 10);
        
        console.log(`[ChatService] Generating LLM response - Model: ${modelName}, Prompt length: ${promptLength} chars, Timeout: ${timeoutSeconds > 0 ? `${timeoutSeconds}s` : 'disabled'}`);
        
        try {
            // Create request with optional timeout using AbortController
            const controller = new AbortController();
            let timeoutId: NodeJS.Timeout | null = null;
            
            if (timeoutSeconds > 0) {
                timeoutId = setTimeout(() => {
                    console.error(`[ChatService] LLM request timeout after ${timeoutSeconds}s - Model: ${modelName}`);
                    controller.abort();
                }, timeoutSeconds * 1000);
            }
            
            try {
                const llmCallStart = Date.now();
                console.log(`[ChatService] Sending request to Ollama - Model: ${modelName}, Prompt length: ${promptLength} chars, Max tokens: 2048`);
                
                const response = await this.openai.chat.completions.create({
                    model: modelName,
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 2048, // Increased token limit for better responses
                }, {
                    signal: timeoutId ? controller.signal : undefined, // Only set signal if timeout is enabled
                });
                
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                const llmCallDuration = Date.now() - llmCallStart;
                
                // Log full response structure for debugging
                console.log(`[ChatService] Ollama response received - Status: OK, Duration: ${llmCallDuration}ms`);
                console.log(`[ChatService] Response structure - Choices count: ${response.choices?.length || 0}, Object: ${response.object}, Model: ${response.model}`);
                
                if (!response.choices || response.choices.length === 0) {
                    console.error(`[ChatService] ERROR: Response has no choices array! Full response:`, JSON.stringify(response, null, 2));
                    throw new Error('LLM returned response with no choices');
                }
                
                const firstChoice = response.choices[0];
                console.log(`[ChatService] First choice - Finish reason: ${firstChoice.finish_reason}, Index: ${firstChoice.index}`);
                
                if (!firstChoice.message) {
                    console.error(`[ChatService] ERROR: First choice has no message! Choice:`, JSON.stringify(firstChoice, null, 2));
                    throw new Error('LLM returned choice with no message');
                }
                
                const content = firstChoice.message.content;
                const contentLength = content?.length || 0;
                const totalDuration = Date.now() - startTime;
                
                console.log(`[ChatService] LLM content extracted - Content length: ${contentLength} chars, Total: ${totalDuration}ms`);
                
                if (!content || content.trim().length === 0) {
                    console.error(`[ChatService] ERROR: Empty or whitespace-only response!`);
                    console.error(`[ChatService] Full response object:`, JSON.stringify(response, null, 2));
                    console.error(`[ChatService] First choice object:`, JSON.stringify(firstChoice, null, 2));
                    throw new Error('LLM returned empty response');
                }
                
                // Log a preview of the content (first 200 chars)
                const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
                console.log(`[ChatService] LLM response content preview: "${contentPreview}"`);
                
                return content;
            } catch (error) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                const totalDuration = Date.now() - startTime;
                
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    console.error(`[ChatService] LLM request aborted (timeout after ${timeoutSeconds}s) after ${totalDuration}ms`);
                    throw new Error(`Request timeout: Model took too long to respond (exceeded ${timeoutSeconds}s limit)`);
                }
                
                console.error(`[ChatService] LLM request failed after ${totalDuration}ms:`, error.message);
                throw error;
            }
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[ChatService] Failed to generate LLM response after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to generate response: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get available models
     */
    async getModels(): Promise<any> {
        try {
            return {
                chat: this.configService.get<string>('OLLAMA_CHAT_MODEL', 'llama3:8b'),
                embedding: this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
            };
        } catch (error) {
            throw new HttpException(
                `Failed to get models: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
