import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class AudioService {
    constructor(private configService: ConfigService) {
        // AudioService now uses local Hugging Face Whisper by default
        // Falls back to OpenAI API if configured
    }

    /**
     * Transcribe audio file to text using local Hugging Face Whisper or OpenAI API
     */
    async transcribeAudio(filePath: string, audioBuffer?: Buffer): Promise<string> {
        try {
            console.log(`[AudioService] Transcribing audio file: ${filePath}`);
            const startTime = Date.now();

            // Try local Hugging Face Whisper first (no API key needed)
            const useLocalWhisper = this.configService.get<string>('USE_LOCAL_WHISPER', 'true') === 'true';
            const whisperModel = this.configService.get<string>('WHISPER_MODEL', 'Xenova/whisper-small');
            
            if (useLocalWhisper) {
                try {
                    console.log(`[AudioService] Using local Hugging Face Whisper model: ${whisperModel}`);
                    
                    const { pipeline } = await import('@xenova/transformers');
                    const fs = await import('fs/promises');
                    
                    // Load Whisper model (downloads on first use, then cached)
                    const transcriber = await pipeline(
                        'automatic-speech-recognition',
                        whisperModel
                    );
                    
                    console.log(`[AudioService] Model loaded, reading audio file...`);
                    
                    // Read audio file and convert to format transformers expects
                    // transformers.js expects raw audio data (16kHz, mono, float32)
                    const audioBuffer = await fs.readFile(filePath);
                    
                    // For MP3/WAV files, we need to decode them first
                    // Use a simple approach: convert audio to raw PCM format
                    // Since transformers.js doesn't have AudioContext in Node.js,
                    // we'll use ffmpeg to convert to raw audio format
                    const { exec } = await import('child_process');
                    const { promisify } = await import('util');
                    const execAsync = promisify(exec);
                    
                    // Convert audio to 16kHz mono WAV using ffmpeg
                    const tempWavPath = filePath.replace(/\.[^.]+$/, '_temp.wav');
                    try {
                        await execAsync(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 -f wav "${tempWavPath}"`);
                        
                        // Read the converted WAV file
                        const wavBuffer = await fs.readFile(tempWavPath);
                        
                        // Parse WAV file to extract raw PCM data
                        // WAV format: 44 bytes header, then PCM data
                        const rawAudio = wavBuffer.slice(44); // Skip WAV header
                        
                        // Convert to Float32Array (transformers.js expects this)
                        const audioData = new Float32Array(rawAudio.length / 2);
                        const int16View = new Int16Array(rawAudio.buffer, rawAudio.byteOffset, rawAudio.length / 2);
                        for (let i = 0; i < audioData.length; i++) {
                            audioData[i] = int16View[i] / 32768.0; // Normalize to -1.0 to 1.0
                        }
                        
                        console.log(`[AudioService] Audio processed, starting transcription...`);
                        
                        // Calculate audio duration to determine chunking strategy
                        // Sample rate is 16000 Hz, audioData is Float32Array (one sample per element)
                        const audioDurationSeconds = audioData.length / 16000;
                        console.log(`[AudioService] Audio duration: ${audioDurationSeconds.toFixed(2)} seconds`);
                        
                        // Configure chunking for long audio files (Whisper processes 30s chunks by default)
                        // Use 30s chunks with 5s stride for overlap to avoid cutting words
                        const chunkLengthS = 30; // Process 30-second chunks
                        const strideLengthS = 5; // 5-second overlap between chunks
                        
                        // Transcribe audio data with chunking for long files
                        const result = await transcriber(audioData, {
                            return_timestamps: false,
                            chunk_length_s: chunkLengthS,
                            stride_length_s: strideLengthS,
                        });
                        
                        const duration = Date.now() - startTime;
                        // Handle result which could be object or array
                        const text = (Array.isArray(result) ? result[0]?.text : result?.text) || '';
                        
                        if (!text || text.trim().length === 0) {
                            throw new Error('Transcription returned empty result');
                        }
                        
                        console.log(`[AudioService] Local Whisper transcription completed - Text length: ${text.length} chars, Duration: ${duration}ms`);
                        
                        // Clean up temp file
                        try {
                            await fs.unlink(tempWavPath);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        
                        return text;
                    } finally {
                        // Ensure temp file is deleted
                        try {
                            await fs.unlink(tempWavPath).catch(() => {});
                        } catch (e) {
                            // Ignore
                        }
                    }
                } catch (localError) {
                    console.error(`[AudioService] Local Whisper failed:`, localError.message);
                    // Fall through to OpenAI if configured
                }
            }

            // Fallback to OpenAI Whisper API if configured
            const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
            const openaiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
            
            if (openaiApiKey) {
                try {
                    console.log(`[AudioService] Falling back to OpenAI Whisper API`);
                    
                    const fs = await import('fs/promises');
                    const buffer = audioBuffer || await fs.readFile(filePath);
                    
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
                        console.log(`[AudioService] OpenAI Whisper transcription completed - Text length: ${text.length} chars, Duration: ${duration}ms`);
                        return text;
                    } else {
                        const errorText = await response.text();
                        console.error(`[AudioService] OpenAI Whisper API error: ${response.status} - ${errorText}`);
                    }
                } catch (openaiError) {
                    console.warn(`[AudioService] OpenAI Whisper API failed:`, openaiError.message);
                }
            }

            // If both methods failed
            throw new Error(
                'No transcription service available. ' +
                'Local Whisper failed and no OPENAI_API_KEY configured. ' +
                'Check logs for details.'
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
