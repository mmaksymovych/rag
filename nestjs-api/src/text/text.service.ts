import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TextChunk {
    text: string;
    chunkId: number;
    sourceId: string;
    metadata?: any;
}

@Injectable()
export class TextService {
    constructor(private configService: ConfigService) { }

    /**
     * Split text into chunks with overlap
     */
    chunkText(text: string, sourceId: string, metadata?: any): TextChunk[] {
        const chunkSize = this.configService.get<number>('CHUNK_SIZE', 1000);
        const chunkOverlap = this.configService.get<number>('CHUNK_OVERLAP', 100);

        const chunks: TextChunk[] = [];
        let chunkId = 0;

        // Split by sentences first, then by chunks
        const sentences = this.splitIntoSentences(text);
        let currentChunk = '';

        for (const sentence of sentences) {
            // If adding this sentence would exceed chunk size, save current chunk
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    chunkId: chunkId++,
                    sourceId,
                    metadata: {
                        ...metadata,
                        chunkSize: currentChunk.length,
                        createdAt: Date.now()
                    }
                });

                // Start new chunk with overlap
                currentChunk = this.getOverlapText(currentChunk, chunkOverlap) + ' ' + sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        // Add the last chunk if it has content
        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk.trim(),
                chunkId: chunkId++,
                sourceId,
                metadata: {
                    ...metadata,
                    chunkSize: currentChunk.length,
                    createdAt: Date.now()
                }
            });
        }

        return chunks;
    }

    /**
     * Split text into sentences
     */
    private splitIntoSentences(text: string): string[] {
        // Simple sentence splitting - can be enhanced with more sophisticated NLP
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Get overlap text from the end of a chunk
     */
    private getOverlapText(text: string, overlapSize: number): string {
        if (text.length <= overlapSize) {
            return text;
        }

        const words = text.split(' ');
        let overlap = '';
        let wordIndex = words.length - 1;

        while (overlap.length < overlapSize && wordIndex >= 0) {
            overlap = words[wordIndex] + (overlap ? ' ' + overlap : '');
            wordIndex--;
        }

        return overlap;
    }

    /**
     * Validate text input
     */
    validateText(text: string): { isValid: boolean; error?: string } {
        const maxLength = this.configService.get<number>('MAX_TEXT_LENGTH', 100000);

        if (!text || text.trim().length === 0) {
            return { isValid: false, error: 'Text cannot be empty' };
        }

        if (text.length > maxLength) {
            return { isValid: false, error: `Text exceeds maximum length of ${maxLength} characters` };
        }

        return { isValid: true };
    }
}
