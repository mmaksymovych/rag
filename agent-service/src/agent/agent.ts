import { runReAct } from './react-agent';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('Agent');

export interface AgentResponse {
  answer: string;
  responseTime: number;
}

export class Agent {
  constructor() {
    logger.info('Agent initialized');
  }

  /**
   * Process a user query
   */
  async processQuery(query: string): Promise<AgentResponse> {
    const startTime = Date.now();

    logger.info('Processing query', {
      queryLength: query.length,
      queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    });

    try {
      console.log(chalk.cyan('\n[REACT MODE] Processing query...'));

      // Use ReAct agent
      const answer = await runReAct(query);

      const responseTime = Date.now() - startTime;

      logger.info('Query processed', {
        responseTime,
        answerLength: answer.length,
      });

      return {
        answer,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      logger.error('Query processing failed', {
        responseTime,
        error: error.message,
      });

      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return `I am a simple ReAct-style agent that can use tools to answer questions.

I have access to a weather tool that can tell you the weather in any city.

Type your question and I'll use the appropriate tool to help you!`;
  }

}

// Export singleton instance
export const agent = new Agent();

