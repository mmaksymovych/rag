import OpenAI from 'openai';
import { config } from '../utils/config';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('LMStudioClient');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export class LMStudioClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: config.lmStudio.apiUrl,
      apiKey: 'lm-studio', // LM Studio doesn't require a real API key
    });
    
    logger.info('LM Studio client initialized', {
      apiUrl: config.lmStudio.apiUrl,
      model: config.lmStudio.chatModel,
    });
  }

  /**
   * General chat completion
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const {
      temperature = 0.7,
      maxTokens = 2048,
      timeout = config.lmStudio.timeoutSeconds * 1000,
    } = options;

    logger.debug('Chat completion request', {
      messageCount: messages.length,
      temperature,
      maxTokens,
    });

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await this.client.chat.completions.create(
        {
          model: config.lmStudio.chatModel,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content || '';
      const duration = Date.now() - startTime;

      logger.info('Chat completion successful', {
        duration,
        responseLength: content.length,
      });

      return content;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Chat completion failed', {
        duration,
        error: error.message,
      });
      throw new Error(`LM Studio chat completion failed: ${error.message}`);
    }
  }

  /**
   * Chat completion for decision making (RAG vs Direct)
   */
  async chatCompletionForDecision(query: string): Promise<{
    needsRAG: boolean;
    reason: string;
    confidence: number;
  }> {
    const startTime = Date.now();
    logger.debug('Decision request', { queryLength: query.length });

    const prompt = `Analyze the following query and determine if it requires information from a knowledge base (RAG) or can be answered directly.

Query: "${query}"

Consider:
- Questions about specific documents, data, or facts that might be in a knowledge base → needs RAG
- General knowledge questions, greetings, or meta questions about yourself → direct answer
- Questions asking "what is..." about common topics → direct answer
- Questions asking about specific content or documents → needs RAG

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "needsRAG": true or false,
  "reason": "brief explanation",
  "confidence": number between 0 and 1
}`;

    try {
      const response = await this.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 200 }
      );

      // Parse JSON response
      const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const result = JSON.parse(cleanResponse);

      const duration = Date.now() - startTime;
      logger.info('Decision completed', {
        duration,
        needsRAG: result.needsRAG,
        confidence: result.confidence,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Decision failed', { duration, error: error.message });
      
      // Default to RAG if decision fails
      return {
        needsRAG: true,
        reason: 'Decision engine failed, defaulting to RAG',
        confidence: 0.5,
      };
    }
  }

  /**
   * Chat completion for self-reflection
   */
  async chatCompletionForReflection(
    query: string,
    answer: string
  ): Promise<{
    accuracy: number;
    relevance: number;
    clarity: number;
    feedback: string;
    suggestions: string[];
  }> {
    const startTime = Date.now();
    logger.debug('Reflection request', {
      queryLength: query.length,
      answerLength: answer.length,
    });

    const prompt = `Evaluate the following Q&A pair:

Question: "${query}"

Answer: "${answer}"

Rate on three dimensions (0-1 scale where 0 is poor and 1 is excellent):
- Accuracy: Is the answer factually correct and trustworthy?
- Relevance: Does it directly address the question asked?
- Clarity: Is it clear, well-structured, and easy to understand?

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "accuracy": number between 0 and 1,
  "relevance": number between 0 and 1,
  "clarity": number between 0 and 1,
  "feedback": "brief overall assessment",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    try {
      const response = await this.chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 300 }
      );

      // Parse JSON response
      const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const result = JSON.parse(cleanResponse);

      const duration = Date.now() - startTime;
      logger.info('Reflection completed', {
        duration,
        accuracy: result.accuracy,
        relevance: result.relevance,
        clarity: result.clarity,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Reflection failed', { duration, error: error.message });
      
      // Return default scores if reflection fails
      return {
        accuracy: 0.5,
        relevance: 0.5,
        clarity: 0.5,
        feedback: 'Reflection engine failed to evaluate',
        suggestions: [],
      };
    }
  }

  /**
   * Test connection to LM Studio
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing LM Studio connection...');
      const response = await this.chatCompletion(
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 10 }
      );
      logger.info('LM Studio connection successful');
      return true;
    } catch (error: any) {
      logger.error('LM Studio connection failed', { error: error.message });
      return false;
    }
  }
}

// Export singleton instance
export const lmStudioClient = new LMStudioClient();

