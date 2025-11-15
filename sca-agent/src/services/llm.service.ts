import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Factory service to create LLM instances for both Ollama and OpenAI-compatible APIs
 */
export class LLMService {
  static createLLM(): BaseChatModel {
    const apiUrl = process.env.LLM_API_URL || process.env.OLLAMA_API_URL || 'http://localhost:11434';
    const model = process.env.LLM_MODEL || process.env.OLLAMA_CHAT_MODEL || 'llama3:8b';
    const useOpenAI = process.env.USE_OPENAI_API === 'true' || apiUrl.includes('localhost:1234') || apiUrl.includes('/v1');

    if (useOpenAI) {
      // Use OpenAI-compatible API (LM Studio, etc.)
      const baseURL = apiUrl.endsWith('/v1') ? apiUrl : `${apiUrl}/v1`;
      console.log(`[LLMService] 🔧 Creating OpenAI-compatible LLM: ${baseURL}, Model: ${model}`);
      
      // Create OpenAI client for direct API calls
      const openai = new OpenAI({
        baseURL: baseURL,
        apiKey: 'lm-studio', // LM Studio doesn't require a real key
      });

      // Return a wrapper that uses OpenAI SDK directly
      return new OpenAICompatibleLLM(openai, model);
    } else {
      // Use Ollama
      console.log(`[LLMService] 🔧 Creating Ollama LLM: ${apiUrl}, Model: ${model}`);
      return new ChatOllama({
        baseUrl: apiUrl,
        model: model,
        temperature: 0.1,
      });
    }
  }
}

/**
 * Wrapper to make OpenAI SDK compatible with LangChain BaseChatModel interface
 */
class OpenAICompatibleLLM extends BaseChatModel {
  private openai: OpenAI;
  private modelName: string;

  constructor(openai: OpenAI, modelName: string) {
    super({} as any); // Use type assertion to avoid deep type instantiation
    this.openai = openai;
    this.modelName = modelName;
  }

  _llmType(): string {
    return 'openai-compatible';
  }

  async _generate(messages: any[], options?: any): Promise<any> {
    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: messages.map((msg: any) => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: msg.content,
      })),
      temperature: 0.1,
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || '';
    return {
      generations: [{
        text: content,
        message: {
          content: content,
          _getType: () => 'ai',
        },
      }],
    };
  }

  async invoke(input: string | any): Promise<any> {
    const messages = typeof input === 'string' 
      ? [{ role: 'user' as const, content: input }]
      : input;

    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: messages,
      temperature: 0.1,
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || '';
    return {
      content: content,
      _getType: () => 'ai',
    };
  }
}

