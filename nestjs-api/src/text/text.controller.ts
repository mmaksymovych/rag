import { Controller, Post, Get, Delete, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { TextService, TextChunk } from './text.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';

export class SubmitTextDto {
    text: string;
    metadata?: any;
}

export class TextResponseDto {
    success: boolean;
    message: string;
    chunks?: TextChunk[];
    sourceId?: string;
}

@Controller('text')
export class TextController {
    constructor(
        private readonly textService: TextService,
        private readonly vectorStoreService: VectorStoreService,
        private readonly embeddingService: EmbeddingService,
    ) { }

    @Post('submit')
    async submitText(@Body() submitTextDto: SubmitTextDto): Promise<TextResponseDto> {
        try {
            // Validate text
            const validation = this.textService.validateText(submitTextDto.text);
            if (!validation.isValid) {
                throw new HttpException(validation.error || 'Invalid text', HttpStatus.BAD_REQUEST);
            }

            // Generate source ID
            const sourceId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Chunk the text
            const chunks = this.textService.chunkText(
                submitTextDto.text,
                sourceId,
                submitTextDto.metadata
            );

            if (chunks.length === 0) {
                throw new HttpException('No valid chunks created from text', HttpStatus.BAD_REQUEST);
            }

            // Generate embeddings for chunks
            const chunkTexts = chunks.map(chunk => chunk.text);
            const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

            // Store chunks with embeddings in vector database
            await this.vectorStoreService.upsertChunksWithEmbeddings(chunks, embeddings);

            return {
                success: true,
                message: `Successfully processed ${chunks.length} chunks`,
                chunks,
                sourceId
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to process text: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get()
    async getTextChunks(): Promise<any> {
        try {
            return await this.vectorStoreService.getAllChunks();
        } catch (error) {
            throw new HttpException(
                `Failed to retrieve text chunks: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(':sourceId')
    async deleteText(@Param('sourceId') sourceId: string): Promise<TextResponseDto> {
        try {
            await this.vectorStoreService.deleteBySourceId(sourceId);
            return {
                success: true,
                message: `Successfully deleted text with source ID: ${sourceId}`
            };
        } catch (error) {
            throw new HttpException(
                `Failed to delete text: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
