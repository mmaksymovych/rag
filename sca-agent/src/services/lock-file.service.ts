import * as fs from 'fs/promises';
import * as path from 'path';

export interface LockFileChunk {
    content: string;
    chunkIndex: number;
    totalChunks: number;
}

export class LockFileService {
    private readonly MAX_CHUNK_SIZE = 150000; // 150KB per chunk

    /**
     * Read and chunk lock file if needed
     */
    async readAndChunkLockFile(projectPath: string): Promise<LockFileChunk[]> {
        const yarnLockPath = path.join(projectPath, 'yarn.lock');
        const packageLockPath = path.join(projectPath, 'package-lock.json');

        let lockFilePath: string;
        let lockFileName: string;

        // Check for yarn.lock first
        try {
            await fs.access(yarnLockPath);
            lockFilePath = yarnLockPath;
            lockFileName = 'yarn.lock';
        } catch {
            // Try package-lock.json
            try {
                await fs.access(packageLockPath);
                lockFilePath = packageLockPath;
                lockFileName = 'package-lock.json';
            } catch {
                throw new Error('No lock file found (yarn.lock or package-lock.json)');
            }
        }

        const content = await fs.readFile(lockFilePath, 'utf-8');
        console.log(`[LockFileService] Read ${lockFileName}, size: ${content.length} chars`);

        // If file is small enough, return as single chunk
        if (content.length <= this.MAX_CHUNK_SIZE) {
            return [
                {
                    content,
                    chunkIndex: 0,
                    totalChunks: 1,
                },
            ];
        }

        // Split into chunks
        return this.chunkLockFile(content, lockFileName);
    }

    /**
     * Split lock file into chunks intelligently
     */
    private chunkLockFile(content: string, lockFileName: string): LockFileChunk[] {
        const chunks: LockFileChunk[] = [];

        if (lockFileName === 'yarn.lock') {
            // For yarn.lock, split by package entries (lines starting with ")
            const lines = content.split('\n');
            let currentChunk = '';
            let chunkIndex = 0;

            for (const line of lines) {
                // If adding this line would exceed chunk size, save current chunk
                if (currentChunk.length + line.length > this.MAX_CHUNK_SIZE && currentChunk.length > 0) {
                    chunks.push({
                        content: currentChunk,
                        chunkIndex: chunkIndex++,
                        totalChunks: 0, // Will be set later
                    });
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }

            // Add last chunk
            if (currentChunk.trim()) {
                chunks.push({
                    content: currentChunk,
                    chunkIndex: chunkIndex,
                    totalChunks: 0, // Will be set later
                });
            }
        } else {
            // For package-lock.json, it's JSON, so we'll split by size
            // This is a simple approach - could be improved to split by package entries
            let offset = 0;
            let chunkIndex = 0;

            while (offset < content.length) {
                const chunkContent = content.substring(offset, offset + this.MAX_CHUNK_SIZE);
                chunks.push({
                    content: chunkContent,
                    chunkIndex: chunkIndex++,
                    totalChunks: 0, // Will be set later
                });
                offset += this.MAX_CHUNK_SIZE;
            }
        }

        // Set total chunks
        chunks.forEach(chunk => {
            chunk.totalChunks = chunks.length;
        });

        console.log(`[LockFileService] Split into ${chunks.length} chunks`);
        return chunks;
    }
}

