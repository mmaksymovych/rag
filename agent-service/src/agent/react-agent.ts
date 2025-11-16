import { ChatOpenAI } from '@langchain/openai';
// Use require for core modules to avoid import issues
const promptsModule = require('@langchain/core/prompts');
const messagesModule = require('@langchain/core/messages');
const ChatPromptTemplate = promptsModule.ChatPromptTemplate;
const AIMessage = messagesModule.AIMessage;
const HumanMessage = messagesModule.HumanMessage;
import { config } from '../utils/config';
import { reactTools, getToolDescriptions } from '../tools';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('ReActAgent');

// Configuration constants
const MAX_ITERATIONS = 20; // Prevent infinite loops
const TOOL_RESULT_MAX_LENGTH = 10000; // Truncate very long tool results
const TOOL_TIMEOUT_MS = 300000; // 5 minutes timeout for tool execution

// Type definitions
interface ToolCall {
    actionName: string;
    actionInput: any;
}

interface AgentState {
    iteration: number;
    messages: any[];
    startTime: number;
}

/**
 * Parse model response to extract tool calls or final answer
 */
function parseModelResponse(text: string): { type: 'tool_call' | 'final_answer' | 'error'; data?: ToolCall | string; error?: string } {
    // Normalize whitespace
    const normalizedText = text.trim();

    // Check for tool calls FIRST (priority over final answer)
    const actionMatch = normalizedText.match(/Action:\s*(.+?)(?:\n|$)/i);
    const inputMatch = normalizedText.match(/Action Input:\s*(\{[\s\S]*?\})(?:\n|$)/i);

    if (actionMatch && inputMatch) {
        try {
            const actionName = actionMatch[1].trim();
            const actionInputStr = inputMatch[1].trim();
            const actionInput = JSON.parse(actionInputStr);

            return {
                type: 'tool_call',
                data: { actionName, actionInput },
            };
        } catch (error: any) {
            return {
                type: 'error',
                error: `Failed to parse Action Input JSON: ${error.message}`,
            };
        }
    }

    // Check for final answer
    const finalAnswerMatch = normalizedText.match(/Final Answer:\s*(.+)/is);
    if (finalAnswerMatch) {
        return {
            type: 'final_answer',
            data: finalAnswerMatch[1].trim(),
        };
    }

    // No valid response format found
    return {
        type: 'error',
        error: 'Response does not contain valid "Action:" with "Action Input:" or "Final Answer:" format',
    };
}

/**
 * Truncate tool result if too long to prevent token overflow
 */
function truncateToolResult(result: string): string {
    if (result.length <= TOOL_RESULT_MAX_LENGTH) {
        return result;
    }

    const truncated = result.substring(0, TOOL_RESULT_MAX_LENGTH);
    const truncationNote = `\n\n[Result truncated from ${result.length} to ${TOOL_RESULT_MAX_LENGTH} characters]`;
    return truncated + truncationNote;
}

/**
 * Execute a tool with timeout and error handling
 */
async function executeTool(toolName: string, toolInput: any): Promise<string> {
    const tool = (reactTools as any)[toolName];

    if (!tool) {
        const availableTools = Object.keys(reactTools).join(', ');
        throw new Error(`Unknown tool: "${toolName}". Available tools: ${availableTools}`);
    }

    logger.info('Executing tool', { toolName, toolInput });

    // Execute with timeout
    const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Tool execution timeout after ${TOOL_TIMEOUT_MS}ms`));
        }, TOOL_TIMEOUT_MS);
    });

    try {
        const result = await Promise.race([
            tool(toolInput),
            timeoutPromise,
        ]);

        const truncatedResult = truncateToolResult(result);
        logger.info('Tool execution complete', {
            toolName,
            resultLength: truncatedResult.length,
            wasTruncated: result.length > TOOL_RESULT_MAX_LENGTH,
        });

        return truncatedResult;
    } catch (error: any) {
        logger.error('Tool execution failed', {
            toolName,
            error: error.message,
        });
        throw error;
    }
}

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
export const reactPrompt = ChatPromptTemplate.fromTemplate(`You are an intelligent assistant that can use tools to answer questions.

TOOLS:
{tools}

IMPORTANT INSTRUCTIONS:
- When the user asks to "analyze the project", "analyze this codebase", "understand the repository", "explain the architecture", or similar questions about the project structure, you MUST use the analyzeProject tool.
- When the user asks about weather in a city, use the getWeather tool.
- Always use tools when appropriate - do not try to answer questions about codebases without using the analyzeProject tool.
- Think step by step before deciding which tool to use.
- After using a tool, analyze the result and decide if you need to use another tool or provide a final answer.

Use this EXACT format:

Thought: [your reasoning about what to do]
Action: [toolName]
Action Input: [JSON object with tool parameters]
Observation: [tool result will appear here]
Final Answer: [your final answer to the user]

Begin!

Question: {input}`);

// Tool descriptions
export const toolDescriptions = getToolDescriptions();

/**
 * ReAct Agent Execution Loop
 * Implements the ReAct (Reasoning + Acting) pattern with proper error handling and loop limits
 */
export async function runReAct(input: string): Promise<string> {
    const state: AgentState = {
        iteration: 0,
        messages: [],
        startTime: Date.now(),
    };

    logger.info('Starting ReAct agent', { input: input.substring(0, 100) });

    // Show available tools on first iteration
    if (state.iteration === 0) {
        console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║                    REACT AGENT                           ║'));
        console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
        console.log(chalk.gray('Available tools:'), Object.keys(reactTools).join(', '));
        console.log('');
    }

    while (state.iteration < MAX_ITERATIONS) {
        state.iteration++;

        try {
            // Format prompt with current input and tools
            // Always include the original input so the agent remembers the user's question
            const prompt = await reactPrompt.format({
                input: input, // Always include original input
                tools: toolDescriptions,
            });

            // Add prompt to message history
            state.messages.push(new HumanMessage(prompt));

            // Invoke model
            logger.debug('Invoking model', { iteration: state.iteration });
            const response = await model.invoke(state.messages);
            const responseText = response.content;

            // Log model response
            console.log(chalk.yellow(`\n[Iteration ${state.iteration}] Model Response:`));
            console.log(chalk.gray(responseText));
            console.log('');

            // Parse response
            const parsed = parseModelResponse(responseText);

            if (parsed.type === 'final_answer') {
                const duration = Date.now() - state.startTime;
                logger.info('ReAct agent completed', {
                    iterations: state.iteration,
                    duration,
                });
                console.log(chalk.green(`\n✅ Final answer received after ${state.iteration} iteration(s)\n`));
                return parsed.data as string;
            }

            if (parsed.type === 'error') {
                logger.warn('Model response parsing error', {
                    iteration: state.iteration,
                    error: parsed.error,
                });

                // Add error to conversation and let model retry
                state.messages.push(new AIMessage(responseText));
                state.messages.push(new HumanMessage(`Error: ${parsed.error}. Please provide a valid response in the required format.`));
                continue;
            }

            // Tool call detected
            const toolCall = parsed.data as ToolCall;
            console.log(chalk.cyan(`\n🔧 Tool Call Detected:`));
            console.log(chalk.white(`   Tool: ${toolCall.actionName}`));
            console.log(chalk.gray(`   Input: ${JSON.stringify(toolCall.actionInput, null, 2)}\n`));

            // Execute tool
            let toolResult: string;
            try {
                toolResult = await executeTool(toolCall.actionName, toolCall.actionInput);
                console.log(chalk.green(`✅ Tool execution complete`));
                console.log(chalk.gray(`   Result length: ${toolResult.length} characters\n`));
            } catch (error: any) {
                const errorMessage = `Tool execution failed: ${error.message}`;
                logger.error('Tool execution error', {
                    toolName: toolCall.actionName,
                    error: error.message,
                });

                // Add error to conversation and let model handle it
                state.messages.push(new AIMessage(responseText));
                state.messages.push(new HumanMessage(`Observation: ${errorMessage}`));
                continue;
            }

            // Add model response and tool result to conversation
            state.messages.push(new AIMessage(responseText));
            state.messages.push(new HumanMessage(`Observation: ${toolResult}`));

        } catch (error: any) {
            logger.error('ReAct loop error', {
                iteration: state.iteration,
                error: error.message,
            });

            // If it's a critical error, throw it
            if (error.message.includes('Unknown tool') || error.message.includes('timeout')) {
                throw error;
            }

            // Otherwise, add error to conversation and continue
            state.messages.push(new HumanMessage(`Error occurred: ${error.message}. Please try again.`));
        }
    }

    // Max iterations reached
    const duration = Date.now() - state.startTime;
    logger.warn('ReAct agent reached max iterations', {
        iterations: MAX_ITERATIONS,
        duration,
    });

    throw new Error(
        `Agent reached maximum iterations (${MAX_ITERATIONS}). This may indicate an infinite loop or the model is not following the required format.`
    );
}
