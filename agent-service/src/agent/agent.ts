import { runReAct } from './react-agent';
import { createComponentLogger } from '../utils/logger';
import { reflectionService, ReflectionResult } from '../services/reflection-service';
import chalk from 'chalk';

const logger = createComponentLogger('Agent');

export interface AgentResponse {
  answer: string;
  responseTime: number;
  reflection?: ReflectionResult;
  improvedAnswer?: string;
  improvementIterations?: number;
}

export class Agent {
  constructor() {
    logger.info('Agent initialized');
  }

  /**
   * Process a user query with self-reflection and improvement
   */
  async processQuery(query: string): Promise<AgentResponse> {
    const startTime = Date.now();

    logger.info('Processing query', {
      queryLength: query.length,
      queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    });

    try {
      console.log(chalk.cyan('\n[REACT MODE] Processing query...'));

      // Step 1: Use ReAct agent to generate initial answer
      let answer = await runReAct(query);

      // Step 2: Self-reflection - evaluate the answer
      console.log(chalk.cyan('\n[SELF-REFLECTION] Evaluating answer quality...'));
      const reflection = await reflectionService.evaluateAnswer(query, answer);
      
      // Display reflection results
      reflectionService.displayReflection(reflection);

      let improvedAnswer: string | undefined;
      let improvementIterations = 0;
      const maxImprovementIterations = 2;

      // Step 3: Self-improvement - improve if needed
      if (reflection.shouldImprove && reflection.improvementSuggestions) {
        console.log(chalk.yellow(`\n[SELF-IMPROVEMENT] Attempting to improve answer...\n`));
        
        let currentAnswer = answer;
        let currentReflection = reflection;

        while (
          improvementIterations < maxImprovementIterations &&
          currentReflection.shouldImprove
        ) {
          improvementIterations++;
          
          console.log(chalk.cyan(`[IMPROVEMENT ITERATION ${improvementIterations}/${maxImprovementIterations}]`));

          // Generate improved answer
          const improved = await reflectionService.improveAnswer(
            query,
            currentAnswer,
            currentReflection.feedback,
            currentReflection.improvementSuggestions || ''
          );

          // Evaluate the improved answer
          const improvedReflection = await reflectionService.evaluateAnswer(query, improved);
          
          console.log(chalk.gray(`  Previous score: ${(currentReflection.scores.overallScore * 100).toFixed(1)}%`));
          console.log(chalk.gray(`  New score: ${(improvedReflection.scores.overallScore * 100).toFixed(1)}%`));

          // Check if improvement is better
          if (improvedReflection.scores.overallScore > currentReflection.scores.overallScore) {
            console.log(chalk.green(`  ✓ Improvement successful (+${((improvedReflection.scores.overallScore - currentReflection.scores.overallScore) * 100).toFixed(1)}%)\n`));
            currentAnswer = improved;
            currentReflection = improvedReflection;
            improvedAnswer = improved;
          } else {
            console.log(chalk.yellow(`  ⚠ No improvement, keeping previous answer\n`));
            break;
          }

          // If we've reached acceptable quality, stop
          if (!currentReflection.shouldImprove) {
            console.log(chalk.green(`✓ Answer quality now meets standards!\n`));
            break;
          }
        }

        // Use improved answer if we have one
        if (improvedAnswer) {
          answer = improvedAnswer;
        }
      } else {
        console.log(chalk.green('✓ Initial answer quality is good, no improvement needed\n'));
      }

      const responseTime = Date.now() - startTime;

      logger.info('Query processed with reflection', {
        responseTime,
        answerLength: answer.length,
        overallScore: reflection.scores.overallScore,
        improvementIterations,
      });

      return {
        answer,
        responseTime,
        reflection,
        improvedAnswer,
        improvementIterations,
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
    return `I am a ReAct-style agent with self-reflection and self-improvement capabilities.

Available tools:
- getWeather: Get weather information for any city
- analyzeProject: Analyze the agent-service project repository

After generating an answer, I:
1. Self-reflect: Evaluate my answer on accuracy, relevance, clarity, and completeness
2. Self-improve: If quality is below 75%, I iteratively improve my answer (up to 2 iterations)

Type your question and I'll use the appropriate tool to help you!`;
  }

}

// Export singleton instance
export const agent = new Agent();

