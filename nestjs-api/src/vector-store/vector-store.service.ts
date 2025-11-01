import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { TextChunk } from '../text/text.service';

export interface SearchResult {
    id: string;
    score: number;
    payload: {
        text: string;
        chunkId: number;
        sourceId: string;
        metadata: any;
    };
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
    private qdrantClient: QdrantClient;
    private collectionName: string;

    constructor(private configService: ConfigService) {
        const qdrantUrl = this.configService.get<string>('QDRANT_URL');
        this.collectionName = this.configService.get<string>('QDRANT_COLLECTION_NAME', 'text_chunks');

        this.qdrantClient = new QdrantClient({
            url: qdrantUrl,
        });
    }

    async onModuleInit() {
        await this.initializeCollection();
    }

    /**
     * Initialize Qdrant collection
     */
    private async initializeCollection(): Promise<void> {
        try {
            // Check if collection exists
            const collections = await this.qdrantClient.getCollections();
            const collectionExists = collections.collections.some(
                (col) => col.name === this.collectionName
            );

            if (!collectionExists) {
                // Create collection with nomic-embed-text dimensions (768)
                await this.qdrantClient.createCollection(this.collectionName, {
                    vectors: {
                        size: 768,
                        distance: 'Cosine',
                    },
                });
                console.log(`Created collection: ${this.collectionName}`);
            } else {
                console.log(`Collection ${this.collectionName} already exists`);
            }
        } catch (error) {
            throw new HttpException(
                `Failed to initialize Qdrant collection: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Store text chunks with embeddings
     */
    async upsertChunksWithEmbeddings(chunks: TextChunk[], embeddings: number[][]): Promise<void> {
        const startTime = Date.now();
        console.log(`[VectorStoreService] Upserting ${chunks.length} chunks to collection: ${this.collectionName}`);
        
        try {
            const points = chunks.map((chunk, index) => ({
                id: Date.now() + index, // Use timestamp + index as integer ID
                vector: embeddings[index],
                payload: {
                    text: chunk.text,
                    chunkId: chunk.chunkId,
                    sourceId: chunk.sourceId,
                    metadata: chunk.metadata,
                    createdAt: Date.now(),
                },
            }));

            const sourceIds = [...new Set(chunks.map(c => c.sourceId))];
            console.log(`[VectorStoreService] Prepared ${points.length} points for upsert, Source IDs: [${sourceIds.join(', ')}]`);

            const upsertStart = Date.now();
            await this.qdrantClient.upsert(this.collectionName, {
                wait: true,
                points,
            });
            const upsertDuration = Date.now() - upsertStart;
            const totalDuration = Date.now() - startTime;
            
            console.log(`[VectorStoreService] Successfully upserted ${points.length} points - Qdrant operation: ${upsertDuration}ms, Total: ${totalDuration}ms`);
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[VectorStoreService] Failed to store chunks after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to store chunks: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Search for similar chunks
     */
    async semanticSearch(queryEmbedding: number[], topK: number = 5): Promise<SearchResult[]> {
        const startTime = Date.now();
        const embeddingDim = queryEmbedding.length;
        console.log(`[VectorStoreService] Semantic search - Collection: ${this.collectionName}, TopK: ${topK}, Embedding dimension: ${embeddingDim}`);
        
        try {
            const searchStart = Date.now();
            const searchResult = await this.qdrantClient.search(this.collectionName, {
                vector: queryEmbedding,
                limit: topK,
                with_payload: true,
            });
            const searchDuration = Date.now() - searchStart;

            const results = searchResult.map((result) => ({
                id: result.id as string,
                score: result.score,
                payload: result.payload as any,
            }));
            
            const totalDuration = Date.now() - startTime;
            const scores = results.map(r => r.score.toFixed(3));
            const sourceIds = [...new Set(results.map(r => r.payload.sourceId))];
            
            console.log(`[VectorStoreService] Found ${results.length} results - Scores: [${scores.join(', ')}], Sources: [${sourceIds.join(', ')}], Qdrant search: ${searchDuration}ms, Total: ${totalDuration}ms`);

            return results;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[VectorStoreService] Failed to search vectors after ${totalDuration}ms:`, error.message);
            throw new HttpException(
                `Failed to search vectors: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get all chunks (for listing)
     */
    async getAllChunks(): Promise<any> {
        try {
            const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
                limit: 1000,
                with_payload: true,
                with_vector: false,
            });

            return {
                chunks: scrollResult.points.map((point) => ({
                    id: point.id,
                    payload: point.payload,
                })),
                total: scrollResult.points.length,
            };
        } catch (error) {
            throw new HttpException(
                `Failed to retrieve chunks: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Delete chunks by source ID
     */
    async deleteBySourceId(sourceId: string): Promise<void> {
        try {
            // First, get all points with the source ID
            const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
                filter: {
                    must: [
                        {
                            key: 'sourceId',
                            match: {
                                value: sourceId,
                            },
                        },
                    ],
                },
                with_payload: true,
                with_vector: false,
            });

            if (scrollResult.points.length > 0) {
                const pointIds = scrollResult.points.map((point) => point.id);
                await this.qdrantClient.delete(this.collectionName, {
                    wait: true,
                    points: pointIds,
                });
            }
        } catch (error) {
            throw new HttpException(
                `Failed to delete chunks: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get collection info
     */
    async getCollectionInfo(): Promise<any> {
        try {
            const collection = await this.qdrantClient.getCollection(this.collectionName);
            return collection;
        } catch (error) {
            throw new HttpException(
                `Failed to get collection info: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
