import * as fs from 'fs';
import * as path from 'path';
import { lmStudioClient } from '../clients/lmstudio-client';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('AnalyzeProjectTool');

// Hardcoded agent-service root directory
const AGENT_SERVICE_ROOT = '/Users/admin/Documents/personal/development/rag/agent-service';

export interface AnalyzeProjectInput {
    rootPath?: string; // Ignored - always uses AGENT_SERVICE_ROOT
    question?: string;
    maxFiles?: number; // Ignored - no longer used
}

/**
 * Get project structure (directories and files) without reading content
 */
function getProjectStructure(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth) {
        return null;
    }

    const structure: any = {
        name: path.basename(dirPath),
        type: 'directory',
        children: [],
    };

    try {
        const items = fs.readdirSync(dirPath);
        const skipDirs = ['node_modules', 'dist', 'build', '.git', 'logs', '.next', 'coverage', '.vscode', '.idea', 'qdrant_storage', 'huggingface_cache'];

        for (const item of items) {
            const itemPath = path.join(dirPath, item);

            try {
                const stats = fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    if (!skipDirs.includes(item) && !item.startsWith('.')) {
                        const child = getProjectStructure(itemPath, maxDepth, currentDepth + 1);
                        if (child) {
                            structure.children.push(child);
                        }
                    }
                } else {
                    const ext = path.extname(item).toLowerCase();
                    const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml'];
                    if (textExtensions.includes(ext)) {
                        structure.children.push({
                            name: item,
                            type: 'file',
                            extension: ext,
                            size: stats.size,
                        });
                    }
                }
            } catch (error) {
                // Skip files/dirs that can't be accessed
                logger.debug('Skipping inaccessible path', { itemPath });
            }
        }
    } catch (error) {
        logger.warn('Error reading directory', { dirPath, error: (error as Error).message });
    }

    return structure;
}

/**
 * Read README file and extract key information
 */
async function analyzeReadme(readmePath: string): Promise<string> {
    try {
        if (!fs.existsSync(readmePath)) {
            return 'README file not found.';
        }

        const readmeContent = fs.readFileSync(readmePath, 'utf-8');

        if (!readmeContent || readmeContent.trim().length === 0) {
            return 'README file is empty.';
        }

        // Use LLM to extract key information from README
        const prompt = `You are analyzing a project README file. Extract and summarize the following information:

1. Project description (what is this project?)
2. Key components or modules
3. Important features or capabilities
4. Any other important information (setup, usage, architecture, etc.)

Provide a concise summary in structured format.

README Content:
\`\`\`markdown
${readmeContent.substring(0, 4000)}${readmeContent.length > 4000 ? '\n... [truncated]' : ''}
\`\`\`

Provide a structured summary with:
- Description
- Key Components
- Important Features/Info`;

        logger.debug('Analyzing README with LLM', { readmePath, contentLength: readmeContent.length });

        const summary = await lmStudioClient.chatCompletion(
            [{ role: 'user', content: prompt }],
            { temperature: 0.3, maxTokens: 1000 }
        );

        return summary;
    } catch (error: any) {
        logger.error('Failed to analyze README', { readmePath, error: error.message });
        return `Error analyzing README: ${error.message}`;
    }
}

/**
 * Format project structure as readable text
 */
function formatProjectStructure(structure: any, indent: string = ''): string {
    if (!structure) return '';

    let output = `${indent}${structure.name}${structure.type === 'directory' ? '/' : ''}\n`;

    if (structure.children && structure.children.length > 0) {
        const sortedChildren = structure.children.sort((a: any, b: any) => {
            // Directories first, then files
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < sortedChildren.length; i++) {
            const child = sortedChildren[i];
            const isLast = i === sortedChildren.length - 1;
            const childIndent = indent + (isLast ? '    ' : '│   ');
            const prefix = isLast ? '└── ' : '├── ';
            output += formatProjectStructure(child, childIndent).replace(/^/, prefix);
        }
    }

    return output;
}

/**
 * Analyze Project Tool for ReAct agent
 * Provides project structure and README summary
 */
export const analyzeProjectTool = {
    name: 'analyzeProject',
    description: `Analyze the agent-service project repository. This tool ALWAYS analyzes ${AGENT_SERVICE_ROOT} - any rootPath parameter will be ignored. Provides: 1) Project structure (directory tree), 2) README summary (description, key components, important info). Use this tool when the user asks to "analyze the project", "analyze this codebase", "understand the repository", "explain the architecture", "what is the project structure", or similar questions about the codebase. IMPORTANT: Always include the user's original question in the "question" field of the Action Input JSON so the analysis can be focused on what they asked.`,
    execute: async ({ rootPath, question }: AnalyzeProjectInput) => {
        // Immediate console log to confirm tool is being called
        console.log(chalk.bold.magenta('\n🔧 [ANALYZE PROJECT TOOL] EXECUTING...'));
        console.log(chalk.gray(`   Input params: rootPath=${rootPath}, question=${question}`));

        const startTime = Date.now();
        // Always use AGENT_SERVICE_ROOT, ignore any provided path
        const resolvedRootPath = AGENT_SERVICE_ROOT;

        logger.info('Starting project analysis', {
            rootPath: resolvedRootPath,
            question,
            note: 'rootPath parameter ignored, using hardcoded AGENT_SERVICE_ROOT',
        });

        console.log(chalk.cyan(`   Using hardcoded path: ${resolvedRootPath}`));

        try {
            console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
            console.log(chalk.cyan('║              PROJECT ANALYSIS STARTED                    ║'));
            console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
            console.log(chalk.white(`Root Path: ${resolvedRootPath}`));
            console.log(chalk.gray(`(Note: Always analyzes agent-service, rootPath parameter ignored)\n`));
            if (question) {
                console.log(chalk.white(`Question: ${question}\n`));
            }

            // Step 1: Get project structure
            console.log(chalk.yellow('[STEP 1/2] Analyzing project structure...'));
            const structure = getProjectStructure(resolvedRootPath, 4);
            const structureText = formatProjectStructure(structure);

            console.log(chalk.green(`  ✓ Project structure analyzed\n`));
            logger.info('Project structure analyzed', { maxDepth: 4 });

            // Step 2: Analyze README
            console.log(chalk.yellow('[STEP 2/2] Analyzing README file...'));
            const readmePath = path.join(resolvedRootPath, 'README.md');
            const readmeSummary = await analyzeReadme(readmePath);

            console.log(chalk.green(`  ✓ README analyzed\n`));
            logger.info('README analyzed', { readmePath });

            // Step 3: Build final response
            const duration = Date.now() - startTime;

            console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
            console.log(chalk.cyan('║              ANALYSIS COMPLETE                           ║'));
            console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
            console.log(chalk.green(`✓ Analysis completed in ${(duration / 1000).toFixed(2)}s\n`));

            // Format final response
            let response = `# Project Analysis: ${path.basename(resolvedRootPath)}\n\n`;
            response += `**Root Directory:** \`${resolvedRootPath}\`\n\n`;

            // Always show question if provided, or indicate it wasn't provided
            if (question) {
                response += `**User Question:** ${question}\n\n`;
            } else {
                response += `**Note:** No specific question was provided. Showing general project overview.\n\n`;
            }

            response += `## 1. Project Structure\n\n`;
            response += `\`\`\`\n${structureText}\`\`\`\n\n`;

            response += `## 2. README Summary\n\n`;
            response += `${readmeSummary}\n\n`;

            response += `---\n`;
            response += `*Analysis completed in ${(duration / 1000).toFixed(2)}s*\n`;

            logger.info('Project analysis complete', {
                duration,
                hasQuestion: !!question,
            });

            return JSON.stringify({
                success: true,
                rootPath: resolvedRootPath,
                question: question || null,
                analysis: {
                    structure: structureText,
                    readmeSummary: readmeSummary,
                },
                duration: `${(duration / 1000).toFixed(2)}s`,
            }, null, 2);
        } catch (error: any) {
            const duration = Date.now() - startTime;
            logger.error('Project analysis failed', {
                duration,
                error: error.message,
            });

            console.error(chalk.red(`\n❌ Analysis failed: ${error.message}\n`));

            return JSON.stringify({
                success: false,
                error: `Failed to analyze project: ${error.message}`,
                rootPath: resolvedRootPath,
                note: 'Always analyzes agent-service directory',
            });
        }
    },
};
