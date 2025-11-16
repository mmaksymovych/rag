import { weatherTool } from './weather-tool';
import { analyzeProjectTool } from './analyze-project-tool';
import { ragTool } from './rag-tool';

/**
 * All ReAct tools
 */
export const reactTools = {
    [weatherTool.name]: weatherTool.execute,
    [analyzeProjectTool.name]: analyzeProjectTool.execute,
    [ragTool.name]: ragTool.execute,
};

/**
 * Get tool descriptions for the prompt
 */
export function getToolDescriptions(): string {
    return [
        `- ${weatherTool.name}(input: JSON with "city" field) - ${weatherTool.description}`,
        `- ${analyzeProjectTool.name}(input: JSON with optional fields: "question" (string, optional question to focus on), "maxFiles" (number, default: 300). Note: rootPath is ignored - always analyzes agent-service directory) - ${analyzeProjectTool.description}`,
        `- ${ragTool.name}(input: JSON with "query" field REQUIRED, optional "context" field) - ${ragTool.description}`,
    ].join('\n');
}

