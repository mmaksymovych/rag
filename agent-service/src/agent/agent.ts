import { runReAct } from './react-agent';
import { createComponentLogger } from '../utils/logger';
import { reflectionService, ReflectionResult } from '../services/reflection-service';
import { decisionService, DecisionResult } from '../services/decision-service';
import chalk from 'chalk';

const logger = createComponentLogger('Agent');

export interface AgentResponse {
  answer: string;
  responseTime: number;
  decision?: DecisionResult;
  reflection?: ReflectionResult;
  improvedAnswer?: string;
  improvementIterations?: number;
}

export class Agent {
  constructor() {
    logger.info('Agent initialized');
  }

  /**
   * Process a user query with intelligent routing, self-reflection and improvement
   */
  async processQuery(query: string): Promise<AgentResponse> {
    const startTime = Date.now();

    logger.info('Processing query', {
      queryLength: query.length,
      queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    });

    try {
      // Step 0: Intelligent routing decision
      const decision = await decisionService.makeDecision(query);

      let answer: string;

      if (decision.decision === 'direct_llm') {
        // Answer directly with LLM (no tools)
        answer = await decisionService.answerDirectly(query);
      } else {
        // Use ReAct agent with tools
        console.log(chalk.cyan('\n[REACT MODE] Processing query with tools...'));
        answer = await runReAct(query);
      }

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

      logger.info('Query processed with routing and reflection', {
        responseTime,
        decision: decision.decision,
        answerLength: answer.length,
        overallScore: reflection.scores.overallScore,
        improvementIterations,
      });

      return {
        answer,
        responseTime,
        decision,
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
    return `I am an intelligent ReAct-style agent with routing, self-reflection, and self-improvement capabilities.

My workflow:
1. Intelligent Routing: Decide whether to answer directly or use tools
2. Answer Generation: Use appropriate method (direct LLM or ReAct with tools)
3. Self-Reflection: Evaluate answer quality (accuracy, relevance, clarity, completeness)
4. Self-Improvement: Iteratively improve if quality is below 75% (up to 2 iterations)

Available tools:
- getWeather: Get weather information for any city
- analyzeProject: Analyze the agent-service project repository
- queryRAG: Query knowledge base for technical documentation and stored information

Type your question and I'll intelligently route it to the best processing method!`;
  }

}

// Export singleton instance
export const agent = new Agent();

