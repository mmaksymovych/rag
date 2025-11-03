import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    HttpException,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { AudioService } from './audio.service';
import { VideoService } from './video.service';
import { TextService } from '../text/text.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as multer from 'multer';
import { memoryStorage, diskStorage } from 'multer';
import * as path from 'path';

// Configure multer for memory storage
const multerConfig = {
    storage: memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // Accept PDF and audio files
        const allowedMimes = [
            'application/pdf',
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/webm',
            'audio/ogg',
            'audio/m4a',
            'audio/x-m4a',
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestException(`File type ${file.mimetype} is not supported. Supported types: PDF, MP3, WAV, WebM, OGG, M4A`));
        }
    },
};

export class FileResponseDto {
    success: boolean;
    message: string;
    sourceId?: string;
    chunks?: number;
    textLength?: number;
    metadata?: any;
}

// Configure multer for disk storage (for large video files)
const videoMulterConfig = {
    storage: diskStorage({
        destination: (req, file, cb) => {
            // Use upload directory from config or default
            const uploadDir = process.env.UPLOAD_DIR || './uploads';
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 9);
            const ext = path.extname(file.originalname);
            cb(null, `${timestamp}_${randomStr}${ext}`);
        },
    }),
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB max file size for videos
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // Accept video files
        const allowedMimes = [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo', // AVI
            'video/webm',
            'video/x-matroska', // MKV
            'video/ogg',
            'application/octet-stream', // Some systems detect MP4 as this
        ];
        
        // Also check file extension as fallback
        const allowedExtensions = ['.mp4', '.mpeg', '.mov', '.avi', '.webm', '.mkv', '.ogg'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new BadRequestException(`File type ${file.mimetype} (${fileExtension}) is not supported. Supported types: MP4, MPEG, QuickTime, AVI, WebM, MKV, OGG`));
        }
    },
};

@Controller('file')
export class FileController {
    constructor(
        private readonly fileService: FileService,
        private readonly audioService: AudioService,
        private readonly videoService: VideoService,
        private readonly textService: TextService,
        private readonly vectorStoreService: VectorStoreService,
        private readonly embeddingService: EmbeddingService,
    ) { }

    /**
     * Upload and process PDF file
     */
    @Post('upload/pdf')
    @UseInterceptors(FileInterceptor('file', multerConfig))
    async uploadPDF(
        @UploadedFile() file: Express.Multer.File,
    ): Promise<FileResponseDto> {
        if (!file) {
            throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
        }

        if (file.mimetype !== 'application/pdf') {
            throw new HttpException('File must be a PDF', HttpStatus.BAD_REQUEST);
        }

        let savedFilePath: string | null = null;

        try {
            console.log(`[FileController] Processing PDF upload - Filename: ${file.originalname}, Size: ${file.size} bytes`);

            // Validate file size
            const maxSize = 50 * 1024 * 1024; // 50MB
            const sizeValidation = this.fileService.validateFileSize(file.size, maxSize);
            if (!sizeValidation.isValid) {
                throw new HttpException(sizeValidation.error || 'File size validation failed', HttpStatus.BAD_REQUEST);
            }

            // Save file temporarily
            savedFilePath = await this.fileService.saveFile(file);

            // Extract text from PDF
            const extractedText = await this.fileService.extractTextFromPDF(savedFilePath);

            if (!extractedText || extractedText.trim().length === 0) {
                throw new HttpException('PDF contains no extractable text', HttpStatus.BAD_REQUEST);
            }

            // Generate source ID
            const sourceId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create metadata
            const metadata = {
                filename: file.originalname,
                fileType: 'pdf',
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: Date.now(),
            };

            // Process text through existing pipeline
            const chunks = this.textService.chunkText(extractedText, sourceId, metadata);

            if (chunks.length === 0) {
                throw new HttpException('No valid chunks created from PDF', HttpStatus.BAD_REQUEST);
            }

            // Generate embeddings
            const chunkTexts = chunks.map(chunk => chunk.text);
            const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

            // Store in vector database
            await this.vectorStoreService.upsertChunksWithEmbeddings(chunks, embeddings);

            console.log(`[FileController] PDF processed successfully - Source ID: ${sourceId}, Chunks: ${chunks.length}`);

            return {
                success: true,
                message: `Successfully processed PDF: ${file.originalname}`,
                sourceId,
                chunks: chunks.length,
                textLength: extractedText.length,
                metadata,
            };
        } catch (error) {
            console.error(`[FileController] Failed to process PDF:`, error.message);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to process PDF: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        } finally {
            // Clean up temporary file
            if (savedFilePath) {
                await this.fileService.deleteFile(savedFilePath);
            }
        }
    }

    /**
     * Upload and process audio file
     */
    @Post('upload/audio')
    @UseInterceptors(FileInterceptor('file', multerConfig))
    async uploadAudio(
        @UploadedFile() file: Express.Multer.File,
    ): Promise<FileResponseDto> {
        if (!file) {
            throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
        }

        if (!this.audioService.isSupportedAudioFormat(file.mimetype)) {
            throw new HttpException(
                `Audio format ${file.mimetype} is not supported. Supported: MP3, WAV, WebM, OGG, M4A`,
                HttpStatus.BAD_REQUEST
            );
        }

        let savedFilePath: string | null = null;

        try {
            console.log(`[FileController] Processing audio upload - Filename: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`);

            // Validate file size
            const maxSize = 50 * 1024 * 1024; // 50MB
            const sizeValidation = this.fileService.validateFileSize(file.size, maxSize);
            if (!sizeValidation.isValid) {
                throw new HttpException(sizeValidation.error || 'File size validation failed', HttpStatus.BAD_REQUEST);
            }

            // Save file temporarily
            savedFilePath = await this.fileService.saveFile(file);

            // Transcribe audio to text
            const transcribedText = await this.audioService.transcribeAudio(savedFilePath, file.buffer);

            if (!transcribedText || transcribedText.trim().length === 0) {
                throw new HttpException('Audio transcription returned no text', HttpStatus.BAD_REQUEST);
            }

            // Generate source ID
            const sourceId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create metadata
            const metadata = {
                filename: file.originalname,
                fileType: 'audio',
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: Date.now(),
            };

            // Process text through existing pipeline
            const chunks = this.textService.chunkText(transcribedText, sourceId, metadata);

            if (chunks.length === 0) {
                throw new HttpException('No valid chunks created from audio transcription', HttpStatus.BAD_REQUEST);
            }

            // Generate embeddings
            const chunkTexts = chunks.map(chunk => chunk.text);
            const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

            // Store in vector database
            await this.vectorStoreService.upsertChunksWithEmbeddings(chunks, embeddings);

            console.log(`[FileController] Audio processed successfully - Source ID: ${sourceId}, Chunks: ${chunks.length}`);

            return {
                success: true,
                message: `Successfully processed audio: ${file.originalname}`,
                sourceId,
                chunks: chunks.length,
                textLength: transcribedText.length,
                metadata,
            };
        } catch (error) {
            console.error(`[FileController] Failed to process audio:`, error.message);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to process audio: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        } finally {
            // Clean up temporary file
            if (savedFilePath) {
                await this.fileService.deleteFile(savedFilePath);
            }
        }
    }

    /**
     * Upload and process video file
     * Uses disk storage for streaming large files
     */
    @Post('upload/video')
    @UseInterceptors(FileInterceptor('file', videoMulterConfig))
    async uploadVideo(
        @UploadedFile() file: Express.Multer.File,
    ): Promise<FileResponseDto> {
        if (!file) {
            throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
        }

        // Check if video format is supported (check both MIME type and extension)
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.mp4', '.mpeg', '.mov', '.avi', '.webm', '.mkv', '.ogg'];
        const isVideoByMime = this.videoService.isSupportedVideoFormat(file.mimetype);
        const isVideoByExt = allowedExtensions.includes(fileExtension);
        
        if (!isVideoByMime && !isVideoByExt) {
            throw new HttpException(
                `Video format ${file.mimetype} (${fileExtension}) is not supported. Supported: MP4, MPEG, QuickTime, AVI, WebM, MKV, OGG`,
                HttpStatus.BAD_REQUEST
            );
        }

        let videoFilePath: string | null = null;
        let audioFilePath: string | null = null;

        try {
            console.log(`[FileController] Processing video upload - Filename: ${file.originalname}, Size: ${file.size} bytes, Type: ${file.mimetype}`);

            // Validate file size
            const maxSize = 1024 * 1024 * 1024; // 1GB
            const sizeValidation = this.fileService.validateFileSize(file.size, maxSize);
            if (!sizeValidation.isValid) {
                throw new HttpException(sizeValidation.error || 'File size validation failed', HttpStatus.BAD_REQUEST);
            }

            // File is already saved to disk by multer (due to diskStorage)
            videoFilePath = file.path;

            // Get video metadata
            let videoMetadata: any = null;
            try {
                videoMetadata = await this.videoService.getVideoMetadata(videoFilePath);
                console.log(`[FileController] Video metadata - Duration: ${videoMetadata.duration}s, Format: ${videoMetadata.format}`);
            } catch (metadataError) {
                console.warn(`[FileController] Failed to get video metadata:`, metadataError.message);
            }

            // Extract audio from video
            audioFilePath = await this.videoService.extractAudioFromVideo(videoFilePath);

            // Transcribe audio to text using Whisper
            const transcribedText = await this.audioService.transcribeAudio(audioFilePath);

            if (!transcribedText || transcribedText.trim().length === 0) {
                throw new HttpException('Video transcription returned no text', HttpStatus.BAD_REQUEST);
            }

            // Generate source ID
            const sourceId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create metadata
            const metadata = {
                filename: file.originalname,
                fileType: 'video',
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: Date.now(),
                videoDuration: videoMetadata?.duration || null,
                videoFormat: videoMetadata?.format || null,
            };

            // Process text through existing pipeline
            const chunks = this.textService.chunkText(transcribedText, sourceId, metadata);

            if (chunks.length === 0) {
                throw new HttpException('No valid chunks created from video transcription', HttpStatus.BAD_REQUEST);
            }

            // Generate embeddings
            const chunkTexts = chunks.map(chunk => chunk.text);
            const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

            // Store in vector database
            await this.vectorStoreService.upsertChunksWithEmbeddings(chunks, embeddings);

            console.log(`[FileController] Video processed successfully - Source ID: ${sourceId}, Chunks: ${chunks.length}`);

            return {
                success: true,
                message: `Successfully processed video: ${file.originalname}`,
                sourceId,
                chunks: chunks.length,
                textLength: transcribedText.length,
                metadata,
            };
        } catch (error) {
            console.error(`[FileController] Failed to process video:`, error.message);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to process video: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        } finally {
            // Clean up temporary files
            if (audioFilePath) {
                await this.videoService.cleanupAudioFile(audioFilePath);
            }
            if (videoFilePath) {
                await this.fileService.deleteFile(videoFilePath);
            }
        }
    }
}
