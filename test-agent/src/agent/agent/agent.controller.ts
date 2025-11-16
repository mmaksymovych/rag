import { Controller, Post, Get } from '@nestjs/common';
import { AgentService, GenerationResult } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('generate-tests')
  async generateTests(): Promise<GenerationResult> {
    return this.agentService.generateTests();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
