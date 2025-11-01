import { Module } from '@nestjs/common';
import { TextController } from './text.controller';
import { TextService } from './text.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [VectorStoreModule, EmbeddingModule],
  controllers: [TextController],
  providers: [TextService],
  exports: [TextService]
})
export class TextModule { }
