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
        try {
            const modelName = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
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
        try {
            const modelName = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
            console.log(`Generating embeddings for ${texts.length} texts using model: ${modelName}`);

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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const embeddings = data.data.map(item => item.embedding);
            console.log(`Generated embeddings with dimensions: ${embeddings.map(e => e.length)}`);

            return embeddings;
        } catch (error) {
            console.error('Embedding generation error:', error);
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
