import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class AudioService {
    private whisperApiUrl: string;

    constructor(private configService: ConfigService) {
        // We'll use Ollama's Whisper API if available, or OpenAI-compatible Whisper endpoint
        this.whisperApiUrl = this.configService.get<string>('WHISPER_API_URL', 'http://ollama:11434');
    }

    /**
     * Transcribe audio file to text using Whisper
     */
    async transcribeAudio(filePath: string, audioBuffer?: Buffer): Promise<string> {
        try {
            console.log(`[AudioService] Transcribing audio file: ${filePath}`);
            const startTime = Date.now();

            // Read file if buffer not provided
            let buffer: Buffer;
            if (audioBuffer) {
                buffer = audioBuffer;
            } else {
                const fs = await import('fs/promises');
                buffer = await fs.readFile(filePath);
            }

            // Try OpenAI-compatible Whisper API (OpenAI API or compatible service)
            const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
            const openaiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
            
            if (openaiApiKey) {
                try {
                    const FormData = (await import('form-data')).default;
                    const formData = new FormData();
                    formData.append('file', buffer, {
                        filename: path.basename(filePath),
                        contentType: 'audio/mpeg',
                    });
                    formData.append('model', 'whisper-1');

                    const response = await fetch(`${openaiBaseUrl}/audio/transcriptions`, {
                        method: 'POST',
                        body: formData as any,
                        headers: {
                            ...formData.getHeaders(),
                            'Authorization': `Bearer ${openaiApiKey}`,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const duration = Date.now() - startTime;
                        const text = data.text || '';
                        console.log(`[AudioService] Audio transcription completed - Text length: ${text.length} chars, Duration: ${duration}ms`);
                        return text;
                    } else {
                        const errorText = await response.text();
                        console.error(`[AudioService] OpenAI Whisper API error: ${response.status} - ${errorText}`);
                    }
                } catch (openaiError) {
                    console.warn(`[AudioService] OpenAI Whisper API failed:`, openaiError.message);
                }
            }

            // Alternative: Try Ollama Whisper if model is available
            // Note: Ollama needs Whisper model to be pulled separately
            const whisperModel = this.configService.get<string>('WHISPER_MODEL');
            if (whisperModel && this.whisperApiUrl) {
                try {
                    // Ollama doesn't have direct Whisper endpoint, would need custom implementation
                    // For now, we'll skip this and recommend using OpenAI Whisper
                    console.warn(`[AudioService] Ollama Whisper not yet implemented. Please use OpenAI Whisper API.`);
                } catch (ollamaError) {
                    console.warn(`[AudioService] Ollama Whisper failed:`, ollamaError.message);
                }
            }

            // Fallback: Return error if no transcription service available
            throw new Error(
                'No audio transcription service available. ' +
                'Please configure OPENAI_API_KEY for OpenAI Whisper, ' +
                'or set up a Whisper service and configure WHISPER_API_URL.'
            );

        } catch (error) {
            console.error(`[AudioService] Failed to transcribe audio:`, error.message);
            throw new HttpException(
                `Failed to transcribe audio: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Check if audio file format is supported
     */
    isSupportedAudioFormat(mimetype: string): boolean {
        const supportedFormats = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/webm',
            'audio/ogg',
            'audio/m4a',
            'audio/x-m4a',
        ];
        return supportedFormats.includes(mimetype);
    }
}
