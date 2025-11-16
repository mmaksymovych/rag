import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../utils/config';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('FileAnalyzer');

export interface FileAnalysisResult {
    success: boolean;
    sourceId?: string;
    filename: string;
    fileType: string;
    chunks: number;
    textLength: number;
    message: string;
}

export interface DirectoryAnalysisResult {
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    results: FileAnalysisResult[];
    summary: string;
}

export class FileAnalyzer {
    private ragApiUrl: string;

    constructor() {
        this.ragApiUrl = config.rag.apiUrl;
        logger.info('File analyzer initialized', { ragApiUrl: this.ragApiUrl });
    }

    /**
     * Analyze a single file and upload to RAG
     */
    async analyzeFile(filePath: string): Promise<FileAnalysisResult> {
        const startTime = Date.now();
        const filename = path.basename(filePath);

        logger.info('Analyzing file', { filePath, filename });

        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Get file stats
            const stats = fs.statSync(filePath);
            const fileExtension = path.extname(filePath).toLowerCase();

            logger.debug('File stats', {
                filename,
                size: stats.size,
                extension: fileExtension,
            });

            // Determine file type and endpoint
            let endpoint: string;
            let fileType: string;

            if (fileExtension === '.pdf') {
                endpoint = '/file/upload/pdf';
                fileType = 'pdf';
            } else if (['.txt', '.md', '.js', '.ts', '.json', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.sh', '.yaml', '.yml', '.xml', '.html', '.css', '.sql'].includes(fileExtension)) {
                // Text files - use text submission endpoint
                return await this.analyzeTextFile(filePath);
            } else {
                throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            // Create form data
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            // Upload to RAG API
            const response = await axios.post(
                `${this.ragApiUrl}${endpoint}`,
                formData,
                {
                    headers: formData.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                }
            );

            const duration = Date.now() - startTime;
            logger.info('File analyzed successfully', {
                filename,
                duration,
                sourceId: response.data.sourceId,
                chunks: response.data.chunks,
            });

            return {
                success: true,
                sourceId: response.data.sourceId,
                filename,
                fileType,
                chunks: response.data.chunks,
                textLength: response.data.textLength,
                message: `Successfully analyzed ${filename}`,
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error('File analysis failed', {
                filename,
                duration,
                error: error.message,
            });

            return {
                success: false,
                filename,
                fileType: 'unknown',
                chunks: 0,
                textLength: 0,
                message: `Failed to analyze ${filename}: ${error.message}`,
            };
        }
    }

    /**
     * Analyze a text file and submit to RAG
     */
    private async analyzeTextFile(filePath: string): Promise<FileAnalysisResult> {
        const startTime = Date.now();
        const filename = path.basename(filePath);

        try {
            // Read file content
            const content = fs.readFileSync(filePath, 'utf-8');

            if (!content || content.trim().length === 0) {
                throw new Error('File is empty');
            }

            // Submit to RAG API
            const response = await axios.post(
                `${this.ragApiUrl}/text/submit`,
                {
                    text: content,
                    metadata: {
                        filename,
                        filePath,
                        fileType: path.extname(filePath).substring(1),
                        analyzedAt: Date.now(),
                    },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            const duration = Date.now() - startTime;
            logger.info('Text file analyzed successfully', {
                filename,
                duration,
                sourceId: response.data.sourceId,
                chunks: response.data.chunks?.length || 0,
            });

            return {
                success: true,
                sourceId: response.data.sourceId,
                filename,
                fileType: 'text',
                chunks: response.data.chunks?.length || 0,
                textLength: content.length,
                message: `Successfully analyzed ${filename}`,
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error('Text file analysis failed', {
                filename,
                duration,
                error: error.message,
            });

            return {
                success: false,
                filename,
                fileType: 'text',
                chunks: 0,
                textLength: 0,
                message: `Failed to analyze ${filename}: ${error.message}`,
            };
        }
    }

    /**
     * Analyze all files in a directory
     */
    async analyzeDirectory(
        directoryPath: string,
        options: {
            recursive?: boolean;
            extensions?: string[];
            exclude?: string[];
        } = {}
    ): Promise<DirectoryAnalysisResult> {
        const startTime = Date.now();
        const {
            recursive = true,
            extensions = ['.txt', '.md', '.js', '.ts', '.json', '.py', '.pdf'],
            exclude = ['node_modules', 'dist', 'build', '.git', 'logs'],
        } = options;

        logger.info('Analyzing directory', {
            directoryPath,
            recursive,
            extensions,
            exclude,
        });

        try {
            // Get all files
            const files = this.getFiles(directoryPath, recursive, extensions, exclude);

            logger.info(`Found ${files.length} files to analyze`);

            // Analyze each file with progress reporting
            const results: FileAnalysisResult[] = [];
            let processedFiles = 0;
            let failedFiles = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progress = `[${i + 1}/${files.length}]`;

                logger.debug(`Analyzing file ${progress}`, { file });

                const result = await this.analyzeFile(file);
                results.push(result);

                if (result.success) {
                    processedFiles++;
                    logger.debug(`File analyzed successfully ${progress}`, {
                        filename: result.filename,
                        chunks: result.chunks,
                    });
                } else {
                    failedFiles++;
                    logger.warn(`File analysis failed ${progress}`, {
                        filename: result.filename,
                        error: result.message,
                    });
                }
            }

            const duration = Date.now() - startTime;
            const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);

            logger.info('Directory analysis complete', {
                duration,
                totalFiles: files.length,
                processedFiles,
                failedFiles,
                totalChunks,
            });

            return {
                totalFiles: files.length,
                processedFiles,
                failedFiles,
                results,
                summary: `Analyzed ${processedFiles}/${files.length} files successfully (${totalChunks} chunks created)`,
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error('Directory analysis failed', {
                duration,
                error: error.message,
            });

            throw new Error(`Failed to analyze directory: ${error.message}`);
        }
    }

    /**
     * Get all files in a directory (with filtering)
     */
    private getFiles(
        dir: string,
        recursive: boolean,
        extensions: string[],
        exclude: string[]
    ): string[] {
        const files: string[] = [];

        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            // Skip excluded directories/files
            if (exclude.some(ex => item.includes(ex))) {
                continue;
            }

            if (stat.isDirectory()) {
                if (recursive) {
                    files.push(...this.getFiles(fullPath, recursive, extensions, exclude));
                }
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    /**
     * Analyze the agent's own repository
     */
    async analyzeSelf(options: {
        includeConfig?: boolean;
        includeTests?: boolean;
        includeDocs?: boolean;
    } = {}): Promise<DirectoryAnalysisResult> {
        const agentDir = path.resolve(__dirname, '../..');

        logger.info('Analyzing agent repository', { agentDir, options });

        // Build list of extensions to include
        const extensions: string[] = ['.ts', '.js', '.json', '.md'];

        if (options.includeConfig !== false) {
            extensions.push('.yaml', '.yml', '.toml', '.ini', '.conf');
        }

        if (options.includeTests !== false) {
            // Test files are already included via .ts/.js
        }

        if (options.includeDocs !== false) {
            extensions.push('.txt', '.rst');
        }

        // Build exclude list
        const exclude = [
            'node_modules',
            'dist',
            'build',
            'logs',
            '.git',
            '.vscode',
            '.idea',
            'coverage',
            '.nyc_output',
            '*.log',
            'package-lock.json', // Usually too large and not useful
        ];

        logger.info('Repository analysis configuration', {
            extensions,
            exclude,
            includeConfig: options.includeConfig,
            includeTests: options.includeTests,
            includeDocs: options.includeDocs,
        });

        return await this.analyzeDirectory(agentDir, {
            recursive: true,
            extensions,
            exclude,
        });
    }
}

// Export singleton instance
export const fileAnalyzer = new FileAnalyzer();

