import { Module } from '@nestjs/common';
import { OpenAIController } from './openai.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [ChatModule],
    controllers: [OpenAIController],
})
export class OpenAIModule { }

