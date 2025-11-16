import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OpenApiService } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { DataPreparationService } from '../data-preparation/data-preparation.service';
import { ReflectionService } from '../reflection/reflection.service';
import { TestGeneratorService } from '../test-generator/test-generator.service';
import { TestRunnerService } from '../test-runner/test-runner.service';
import { FileWriterService } from '../file-writer/file-writer.service';

@Module({
  imports: [HttpModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    OpenApiService,
    RagService,
    GapAnalysisService,
    DataPreparationService,
    ReflectionService,
    TestGeneratorService,
    TestRunnerService,
    FileWriterService,
  ],
  exports: [AgentService],
})
export class AgentModule {}

