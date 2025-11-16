import { lmStudioClient } from '../clients/lmstudio-client';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('DecisionService');

export type DecisionType = 'direct_llm' | 'use_tools';

export interface DecisionResult {
  decision: DecisionType;
  reasoning: string;
  confidence: number; // 0-1
  suggestedTool?: string;
}

/**
 * Decision Service
 * Determines whether to answer directly with LLM or use tools/RAG
 */
export class DecisionService {
  constructor() {
    logger.info('Decision service initialized');
  }

  /**
   * Decide how to handle a user query
   */
  async makeDecision(userQuery: string): Promise<DecisionResult> {
    const startTime = Date.now();

    logger.info('Making routing decision', {
      queryLength: userQuery.length,
      queryPreview: userQuery.substring(0, 100),
    });

    console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║              INTELLIGENT ROUTING DECISION                ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.white(`Query: "${userQuery}"\n`));

    try {
      const prompt = `You are an intelligent routing system that decides how to handle user queries.

USER QUERY:
"${userQuery}"

AVAILABLE OPTIONS:
1. **direct_llm** - Answer directly using your knowledge (for general questions, greetings, simple explanations)
2. **use_tools** - Use specialized tools (for specific tasks requiring external data or processing)

AVAILABLE TOOLS:
- getWeather: Get weather for a city
- analyzeProject: Analyze the agent-service codebase structure
- queryRAG: Query knowledge base for technical documentation, stored information

DECISION CRITERIA:

Use **direct_llm** when:
- Simple greetings ("hello", "hi", "how are you")
- General knowledge questions you can answer
- Explanations of common concepts
- Conversational queries
- Math or logic problems

Use **use_tools** when:
- Weather queries → suggest "getWeather"
- Questions about project structure, codebase, architecture → suggest "analyzeProject"
- Questions about technical docs, databases, stored knowledge → suggest "queryRAG"
- Specific data retrieval needed

Respond in PURE JSON format (no markdown, no code blocks):
{
  "decision": "direct_llm" or "use_tools",
  "reasoning": "Brief explanation why",
  "confidence": 0.0-1.0,
  "suggestedTool": "toolName or null"
}`;

      const response = await lmStudioClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.2, maxTokens: 300 }
      );

      // Clean and parse JSON
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const decision = JSON.parse(cleanedResponse) as DecisionResult;

      const duration = Date.now() - startTime;

      logger.info('Decision made', {
        duration,
        decision: decision.decision,
        confidence: decision.confidence,
        suggestedTool: decision.suggestedTool,
      });

      // Display decision
      const decisionColor = decision.decision === 'direct_llm' ? chalk.blue : chalk.magenta;
      console.log(decisionColor(`Decision: ${decision.decision.toUpperCase()}`));
      console.log(chalk.gray(`Reasoning: ${decision.reasoning}`));
      console.log(chalk.gray(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`));
      if (decision.suggestedTool) {
        console.log(chalk.yellow(`Suggested Tool: ${decision.suggestedTool}`));
      }
      console.log(chalk.gray(`Duration: ${duration}ms\n`));

      return decision;
    } catch (error: any) {
      logger.error('Decision making failed', {
        error: error.message,
      });

      console.log(chalk.red(`❌ Decision error: ${error.message}`));
      console.log(chalk.yellow(`Defaulting to: use_tools\n`));

      // Default to using tools if decision fails
      return {
        decision: 'use_tools',
        reasoning: `Decision service failed: ${error.message}. Defaulting to tools for safety.`,
        confidence: 0.5,
      };
    }
  }

  /**
   * Answer directly with LLM (no tools)
   */
  async answerDirectly(userQuery: string): Promise<string> {
    const startTime = Date.now();

    logger.info('Answering directly with LLM', {
      queryLength: userQuery.length,
    });

    console.log(chalk.blue('\n[DIRECT LLM MODE] Generating answer...\n'));

    try {
      const response = await lmStudioClient.chatCompletion(
        [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Provide clear, accurate, and concise answers.',
          },
          {
            role: 'user',
            content: userQuery,
          },
        ],
        { temperature: 0.7, maxTokens: 1000 }
      );

      const duration = Date.now() - startTime;

      logger.info('Direct answer generated', {
        duration,
        responseLength: response.length,
      });

      console.log(chalk.green(`✅ Direct answer generated in ${(duration / 1000).toFixed(2)}s\n`));

      return response;
    } catch (error: any) {
      logger.error('Direct answer failed', {
        error: error.message,
      });

      throw new Error(`Failed to generate direct answer: ${error.message}`);
    }
  }
}

// Export singleton instance
export const decisionService = new DecisionService();

