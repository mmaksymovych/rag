import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
// Import fluent-ffmpeg using require (CommonJS module)
const ffmpeg = require('fluent-ffmpeg');

@Injectable()
export class VideoService {
    private uploadDir: string;

    constructor(private configService: ConfigService) {
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    }

    /**
     * Check if ffmpeg is available
     */
    async checkFfmpegAvailable(): Promise<boolean> {
        try {
            await execAsync('ffmpeg -version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Extract audio from video file
     */
    async extractAudioFromVideo(videoPath: string, outputFormat: string = 'mp3'): Promise<string> {
        try {
            console.log(`[VideoService] Extracting audio from video: ${videoPath}`);
            const startTime = Date.now();

            // Check if ffmpeg is available
            const ffmpegAvailable = await this.checkFfmpegAvailable();
            if (!ffmpegAvailable) {
                throw new Error('ffmpeg is not installed or not available in PATH. Please install ffmpeg to process video files.');
            }

            // Generate output audio file path
            const videoBasename = path.basename(videoPath, path.extname(videoPath));
            const audioOutputPath = path.join(
                path.dirname(videoPath),
                `${videoBasename}_audio.${outputFormat}`
            );

            console.log(`[VideoService] Converting video to audio - Output: ${audioOutputPath}`);

            // Extract audio using ffmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpeg(videoPath)
                    .toFormat(outputFormat)
                    .audioCodec('libmp3lame') // Use MP3 codec
                    .audioBitrate(128)
                    .on('start', (commandLine) => {
                        console.log(`[VideoService] FFmpeg command: ${commandLine}`);
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            console.log(`[VideoService] Processing: ${Math.round(progress.percent)}% done`);
                        }
                    })
                    .on('end', () => {
                        console.log(`[VideoService] Audio extraction completed`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`[VideoService] FFmpeg error:`, err.message);
                        reject(new Error(`Failed to extract audio: ${err.message}`));
                    })
                    .save(audioOutputPath);
            });

            const duration = Date.now() - startTime;
            console.log(`[VideoService] Audio extraction completed - Output: ${audioOutputPath}, Duration: ${duration}ms`);

            return audioOutputPath;
        } catch (error) {
            console.error(`[VideoService] Failed to extract audio from video:`, error.message);
            throw new HttpException(
                `Failed to extract audio from video: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get video metadata (duration, format, etc.)
     */
    async getVideoMetadata(videoPath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(new Error(`Failed to get video metadata: ${err.message}`));
                    return;
                }
                resolve({
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    bitrate: metadata.format.bit_rate,
                    format: metadata.format.format_name,
                    streams: metadata.streams.map(stream => ({
                        codec: stream.codec_name,
                        type: stream.codec_type,
                        duration: stream.duration,
                    })),
                });
            });
        });
    }

    /**
     * Check if video file format is supported
     */
    isSupportedVideoFormat(mimetype: string): boolean {
        const supportedFormats = [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo', // AVI
            'video/webm',
            'video/x-matroska', // MKV
            'video/ogg',
        ];
        return supportedFormats.includes(mimetype);
    }

    /**
     * Clean up temporary audio file
     */
    async cleanupAudioFile(audioPath: string): Promise<void> {
        try {
            await fs.unlink(audioPath);
            console.log(`[VideoService] Temporary audio file deleted: ${audioPath}`);
        } catch (error) {
            console.warn(`[VideoService] Failed to delete audio file ${audioPath}:`, error.message);
            // Don't throw - cleanup is not critical
        }
    }
}
