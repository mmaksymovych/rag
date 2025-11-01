import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

// Dynamic import for pdf-parse to handle CommonJS module
// pdf-parse exports PDFParse function and other classes
let pdfParseFn: any;
async function loadPdfParse() {
    if (!pdfParseFn) {
        try {
            // Try ES6 import first
            const pdfModule = await import('pdf-parse');
            pdfParseFn = pdfModule.default || pdfModule.PDFParse || pdfModule;
            
            // If not a function, try require (CommonJS)
            if (typeof pdfParseFn !== 'function') {
                const pdfRequire = require('pdf-parse');
                pdfParseFn = pdfRequire.PDFParse || pdfRequire.default || pdfRequire;
            }
        } catch {
            // Fallback to require
            const pdfRequire = require('pdf-parse');
            pdfParseFn = pdfRequire.PDFParse || pdfRequire.default || pdfRequire;
        }
        
        // Final check
        if (typeof pdfParseFn !== 'function') {
            throw new Error('Failed to load pdf-parse function');
        }
    }
    return pdfParseFn;
}

@Injectable()
export class FileService {
    private uploadDir: string;

    constructor(private configService: ConfigService) {
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
        this.ensureUploadDir();
    }

    /**
     * Ensure upload directory exists
     */
    private async ensureUploadDir(): Promise<void> {
        try {
            await fs.access(this.uploadDir);
        } catch {
            await fs.mkdir(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Extract text from PDF file
     */
    async extractTextFromPDF(filePath: string): Promise<string> {
        try {
            console.log(`[FileService] Extracting text from PDF: ${filePath}`);
            const startTime = Date.now();

            // Load pdf-parse - it exports PDFParse as a class
            const pdfModule = await import('pdf-parse');
            const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || require('pdf-parse').PDFParse;
            
            const dataBuffer = await fs.readFile(filePath);
            
            // Create instance and get text
            const pdfParser = new PDFParse({ data: dataBuffer });
            const textResult = await pdfParser.getText();

            const duration = Date.now() - startTime;
            const extractedText = textResult.text || '';
            const textLength = extractedText.length;
            const pageCount = textResult.total || 1;

            console.log(`[FileService] PDF extraction completed - Pages: ${pageCount}, Text length: ${textLength} chars, Duration: ${duration}ms`);

            return extractedText;
        } catch (error) {
            console.error(`[FileService] Failed to extract text from PDF:`, error.message);
            throw new HttpException(
                `Failed to extract text from PDF: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Save uploaded file to disk
     */
    async saveFile(file: Express.Multer.File): Promise<string> {
        try {
            await this.ensureUploadDir();

            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 9);
            const ext = path.extname(file.originalname);
            const fileName = `${timestamp}_${randomStr}${ext}`;
            const filePath = path.join(this.uploadDir, fileName);

            await fs.writeFile(filePath, file.buffer);

            console.log(`[FileService] File saved - Path: ${filePath}, Size: ${file.size} bytes, Type: ${file.mimetype}`);

            return filePath;
        } catch (error) {
            console.error(`[FileService] Failed to save file:`, error.message);
            throw new HttpException(
                `Failed to save file: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Delete temporary file
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
            console.log(`[FileService] Temporary file deleted: ${filePath}`);
        } catch (error) {
            console.warn(`[FileService] Failed to delete file ${filePath}:`, error.message);
            // Don't throw - file cleanup is not critical
        }
    }

    /**
     * Get file extension from filename
     */
    getFileExtension(filename: string): string {
        return path.extname(filename).toLowerCase().substring(1);
    }

    /**
     * Validate file type
     */
    validateFileType(mimetype: string, allowedTypes: string[]): boolean {
        return allowedTypes.includes(mimetype);
    }

    /**
     * Validate file size
     */
    validateFileSize(size: number, maxSize: number): { isValid: boolean; error?: string } {
        if (size > maxSize) {
            return {
                isValid: false,
                error: `File size ${size} bytes exceeds maximum allowed size of ${maxSize} bytes`
            };
        }
        return { isValid: true };
    }
}
