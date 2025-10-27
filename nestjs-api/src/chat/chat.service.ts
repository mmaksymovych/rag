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
        try {
            const { query, topK = 5 } = chatRequest;

            // Generate embedding for the query
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);

            // Search for relevant chunks
            const searchResults = await this.vectorStoreService.semanticSearch(queryEmbedding, topK);

            if (searchResults.length === 0) {
                return {
                    response: "I don't have any relevant information to answer your question. Please add some text content first.",
                    context: [],
                    sources: []
                };
            }

            // Format context from search results
            const context = searchResults.map(result => result.payload.text).join('\n\n');
            const sources = [...new Set(searchResults.map(result => result.payload.sourceId))];

            // Create RAG prompt
            const prompt = this.createRAGPrompt(query, context);

            // Generate response using Ollama
            const response = await this.generateResponse(prompt);

            return {
                response,
                context: searchResults,
                sources
            };
        } catch (error) {
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
        try {
            const response = await this.openai.chat.completions.create({
                model: this.configService.get<string>('OLLAMA_CHAT_MODEL', 'llama3:8b'),
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            });

            return response.choices[0]?.message?.content || 'No response generated';
        } catch (error) {
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
