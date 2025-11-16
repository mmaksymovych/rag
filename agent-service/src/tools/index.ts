import { weatherTool } from './weather-tool';

/**
 * All ReAct tools
 */
export const reactTools = {
    [weatherTool.name]: weatherTool.execute,
};

/**
 * Get tool descriptions for the prompt
 */
export function getToolDescriptions(): string {
    return `- ${weatherTool.name}(input: JSON with "city" field) - ${weatherTool.description}`;
}

