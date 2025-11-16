import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

export interface Config {
  lmStudio: {
    apiUrl: string;
    chatModel: string;
    timeoutSeconds: number;
  };
  rag: {
    apiUrl: string;
    endpoint: string;
  };
  agent: {
    name: string;
    description: string;
  };
  logging: {
    level: string;
    dir: string;
  };
}

export const config: Config = {
  lmStudio: {
    apiUrl: process.env.LM_STUDIO_API_URL || 'http://localhost:1234/v1',
    chatModel: process.env.LM_STUDIO_CHAT_MODEL || 'openai/gpt-oss-20b',
    timeoutSeconds: parseInt(process.env.LM_STUDIO_TIMEOUT_SECONDS || '600', 10),
  },
  rag: {
    apiUrl: process.env.RAG_API_URL || 'http://localhost:3000',
    endpoint: process.env.RAG_API_ENDPOINT || '/chat',
  },
  agent: {
    name: process.env.AGENT_NAME || 'Conversational Agent',
    description: process.env.AGENT_DESCRIPTION || 
      'An intelligent agent that can answer questions using RAG or direct knowledge',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
};

