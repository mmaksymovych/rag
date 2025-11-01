import { Controller, Post, Get, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService, ChatRequest, ChatResponse } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post()
    async chat(@Body() chatRequest: ChatRequest): Promise<ChatResponse> {
        try {
            if (!chatRequest.query || chatRequest.query.trim().length === 0) {
                throw new HttpException('Query cannot be empty', HttpStatus.BAD_REQUEST);
            }

            return await this.chatService.processChat(chatRequest);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Chat processing failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }


    @Get('models')
    async getModels(): Promise<any> {
        try {
            return await this.chatService.getModels();
        } catch (error) {
            throw new HttpException(
                `Failed to get models: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
