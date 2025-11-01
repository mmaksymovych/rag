import { Controller, Post, Get, Body, HttpException, HttpStatus, HttpCode } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';

/**
 * OpenAI-compatible endpoints for LibreChat integration
 * These endpoints allow LibreChat to use our RAG system as a custom endpoint
 */
@Controller('v1')
export class OpenAIController {
    constructor(private readonly chatService: ChatService) { }

    /**
     * OpenAI-compatible chat completions endpoint
     * LibreChat will use this endpoint to chat with RAG system
     */
    @Post('chat/completions')
    @HttpCode(HttpStatus.OK)
    async chatCompletions(@Body() body: any): Promise<any> {
        try {
            console.log('[OpenAI Controller] Received chat completion request');
            // Extract the last user message from OpenAI format
            const messages = body.messages || [];
            const lastMessage = messages[messages.length - 1];
            
            if (!lastMessage || !lastMessage.content) {
                throw new HttpException('Invalid request format', HttpStatus.BAD_REQUEST);
            }

            // Handle different content formats (string or array for multi-modal)
            let query: string;
            if (typeof lastMessage.content === 'string') {
                query = lastMessage.content;
            } else if (Array.isArray(lastMessage.content)) {
                // Extract text from content array (handles multi-modal content)
                const textParts = lastMessage.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text || '');
                query = textParts.join(' ').trim();
                if (!query) {
                    throw new HttpException('No text content found in message', HttpStatus.BAD_REQUEST);
                }
            } else {
                throw new HttpException('Invalid content format', HttpStatus.BAD_REQUEST);
            }

            const topK = body.topK || 5;

            const queryPreview = query.length > 50 ? query.substring(0, 50) + '...' : query;
            console.log(`[OpenAI Controller] Processing chat completion - Query: "${queryPreview}", Model: ${body.model || 'rag-llama3'}, TopK: ${topK}`);
            const startTime = Date.now();

            // Process using RAG system (retrieves from Qdrant)
            const ragResponse = await this.chatService.processChat({ query, topK });
            
            const duration = Date.now() - startTime;
            const responseLength = ragResponse.response.length;
            const contextChunks = ragResponse.context.length;
            const sourceCount = ragResponse.sources.length;
            console.log(`[OpenAI Controller] RAG processing completed in ${duration}ms - Response: ${responseLength} chars, Context chunks: ${contextChunks}, Sources: ${sourceCount}`);

            // Validate response is not empty
            if (!ragResponse.response || ragResponse.response.trim().length === 0) {
                console.error(`[OpenAI Controller] ERROR: RAG service returned empty response!`);
                console.error(`[OpenAI Controller] RAG Response object:`, JSON.stringify(ragResponse, null, 2));
                throw new HttpException(
                    'Received empty response from chat model call',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            // Log response preview before returning
            const responsePreview = ragResponse.response.length > 200 
                ? ragResponse.response.substring(0, 200) + '...' 
                : ragResponse.response;
            console.log(`[OpenAI Controller] Returning response preview: "${responsePreview}"`);

            // Return OpenAI-compatible response format
            const openAIResponse = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: body.model || 'rag-llama3',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: ragResponse.response,
                        },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: Math.floor(query.length / 4), // Approximate
                    completion_tokens: Math.floor(ragResponse.response.length / 4), // Approximate
                    total_tokens: Math.floor((query.length + ragResponse.response.length) / 4),
                },
            };

            console.log(`[OpenAI Controller] Final OpenAI response - Content length: ${openAIResponse.choices[0].message.content.length} chars, Finish reason: ${openAIResponse.choices[0].finish_reason}`);
            
            // Serialize to JSON to check for any serialization issues
            try {
                const jsonResponse = JSON.stringify(openAIResponse);
                console.log(`[OpenAI Controller] Response JSON length: ${jsonResponse.length} bytes`);
                console.log(`[OpenAI Controller] Response JSON preview (first 500 chars): ${jsonResponse.substring(0, 500)}...`);
                
                // Verify the content is still there after serialization
                const parsed = JSON.parse(jsonResponse);
                if (!parsed.choices || !parsed.choices[0] || !parsed.choices[0].message || !parsed.choices[0].message.content) {
                    console.error(`[OpenAI Controller] ERROR: Content missing after JSON serialization!`);
                    console.error(`[OpenAI Controller] Parsed object:`, JSON.stringify(parsed, null, 2));
                } else {
                    console.log(`[OpenAI Controller] Verification passed - Content exists: ${parsed.choices[0].message.content.length} chars`);
                }
            } catch (serializationError) {
                console.error(`[OpenAI Controller] ERROR during JSON serialization:`, serializationError);
            }
            
            console.log(`[OpenAI Controller] About to return response object...`);
            
            // @HttpCode decorator ensures we return 200 OK (not 201 Created)
            // This matches OpenAI API behavior
            return openAIResponse;
        } catch (error) {
            console.error('[OpenAI Controller] Error processing chat:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            throw new HttpException(
                `Chat processing failed: ${errorMessage}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * OpenAI-compatible models endpoint
     * LibreChat will query this to see available models
     */
    @Get('models')
    async listModels(): Promise<any> {
        try {
            return {
                object: 'list',
                data: [
                    {
                        id: 'rag-llama3',
                        object: 'model',
                        created: Math.floor(Date.now() / 1000),
                        owned_by: 'custom',
                        permission: [],
                        root: 'rag-llama3',
                        parent: null,
                    },
                ],
            };
        } catch (error) {
            throw new HttpException(
                `Failed to get models: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

