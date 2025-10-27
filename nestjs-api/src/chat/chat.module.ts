import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [VectorStoreModule, EmbeddingModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule { }
