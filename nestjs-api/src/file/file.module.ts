import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { AudioService } from './audio.service';
import { VideoService } from './video.service';
import { TextModule } from '../text/text.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [TextModule, VectorStoreModule, EmbeddingModule],
  controllers: [FileController],
  providers: [FileService, AudioService, VideoService],
  exports: [FileService, AudioService, VideoService],
})
export class FileModule { }
