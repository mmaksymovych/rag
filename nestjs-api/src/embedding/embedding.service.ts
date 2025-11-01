import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
    private ollamaApiUrl: string;

    constructor(private configService: ConfigService) {
        this.ollamaApiUrl = this.configService.get<string>('OLLAMA_API_URL') || 'http://ollama:11434/v1';
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const startTime = Date.now();
        const modelName = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
        const textLength = text.length;
        
        console.log(`[EmbeddingService] Generating embedding - Model: ${modelName}, Text length: ${textLength} chars`);
        
        try {
            const fetchStart = Date.now();
            const response = await fetch(`${this.ollamaApiUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    input: text,
                }),
            });

            const fetchDuration = Date.now() - fetchStart;
            console.log(`[EmbeddingService] Ollama API call completed in ${fetchDuration}ms, Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[EmbeddingService] Ollama API error - Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const embedding = data.data[0].embedding;
            const dimension = embedding?.length || 0;
            const totalDuration = Date.now() - startTime;
            
            console.log(`[EmbeddingService] Embedding generated - Dimension: ${dimension}, Total duration: ${totalDuration}ms`);
            
            return embedding;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[EmbeddingService] Failed to generate embedding after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to generate embedding: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Generate embeddings for multiple texts
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const startTime = Date.now();
        const modelName = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
        const totalTextLength = texts.reduce((sum, text) => sum + text.length, 0);
        
        console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts - Model: ${modelName}, Total text length: ${totalTextLength} chars`);

        try {
            const fetchStart = Date.now();
            const response = await fetch(`${this.ollamaApiUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    input: texts,
                }),
            });

            const fetchDuration = Date.now() - fetchStart;
            console.log(`[EmbeddingService] Ollama API call completed in ${fetchDuration}ms, Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[EmbeddingService] Ollama API error - Status: ${response.status}, Body: ${errorText.substring(0, 200)}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const embeddings = data.data.map(item => item.embedding);
            const dimensions = embeddings.map(e => e.length);
            const totalDuration = Date.now() - startTime;
            
            console.log(`[EmbeddingService] Generated ${embeddings.length} embeddings - Dimensions: [${dimensions.join(', ')}], Total duration: ${totalDuration}ms`);

            return embeddings;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[EmbeddingService] Failed to generate embeddings after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to generate embeddings: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get embedding model info
     */
    async getModelInfo(): Promise<any> {
        try {
            // This would typically call Ollama's model info endpoint
            return {
                model: this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
                dimension: 768, // nomic-embed-text dimension
                maxTokens: 2048
            };
        } catch (error) {
            throw new HttpException(
                `Failed to get model info: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
