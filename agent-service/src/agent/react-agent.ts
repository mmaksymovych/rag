import { ChatOpenAI } from '@langchain/openai';
// Use require for core modules to avoid import issues
const promptsModule = require('@langchain/core/prompts');
const messagesModule = require('@langchain/core/messages');
const ChatPromptTemplate = promptsModule.ChatPromptTemplate;
const AIMessage = messagesModule.AIMessage;
const HumanMessage = messagesModule.HumanMessage;
import { config } from '../utils/config';
import { reactTools, getToolDescriptions } from '../tools';

// 1. Connect LangChain to LM Studio
export const model = new ChatOpenAI({
    apiKey: 'lm-studio', // dummy, required by LangChain
    configuration: {
        baseURL: config.lmStudio.apiUrl, // LM Studio local server
    },
    modelName: config.lmStudio.chatModel, // ignored by LM Studio
    temperature: 0,
});

// 2. Export tools for use in agent
export const tools = reactTools;

// 3. ReAct Prompt Template
export const reactPrompt = ChatPromptTemplate.fromTemplate(`
You are an intelligent assistant that can use tools.

TOOLS:
{tools}

Use this format:

Thought: what you think
Action: toolName
Action Input: JSON for the tool
Observation: tool result
Final Answer: final answer once done

Begin!

Question: {input}
`);

// Tool descriptions
export const toolDescriptions = getToolDescriptions();

// 4. ReAct Agent Execution Loop
export async function runReAct(input: string): Promise<string> {
    let messages: any[] = [];
    let response: any;

    while (true) {
        const prompt = await reactPrompt.format({
            input,
            tools: toolDescriptions,
        });

        messages.push(new HumanMessage(prompt));

        response = await model.invoke(messages);

        const text = response.content;
        console.log('MODEL:', text);

        if (text.includes('Final Answer:')) {
            return text.split('Final Answer:')[1].trim();
        }

        const actionMatch = text.match(/Action:\s*(.*)/);
        const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\})/);

        if (!actionMatch || !inputMatch) {
            return 'Could not understand tool call.';
        }

        const actionName = actionMatch[1].trim();
        const actionInput = JSON.parse(inputMatch[1]);

        console.log('TOOL CALL:', actionName, actionInput);

        const tool = (tools as any)[actionName];
        if (!tool) throw new Error(`Unknown tool: ${actionName}`);

        const result = await tool(actionInput);
        console.log('TOOL RESULT:', result);

        messages.push(new AIMessage(text));
        messages.push(new HumanMessage(`Observation: ${result}`));
    }
}

