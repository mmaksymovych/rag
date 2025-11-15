import { Tool } from '@langchain/core/tools';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LockFileService, LockFileChunk } from '../../services/lock-file.service';
import { ExtractedVulnerability, VulnerabilityMatch, ProjectDependency } from '../../types/sca.types';
import { LLMService } from '../../services/llm.service';
import * as path from 'path';

export class LockFileAnalyzerTool extends Tool {
    name = 'lock_file_analyzer';
    description = 'Analyzes yarn.lock or package-lock.json to check if vulnerable packages exist in the dependency tree (including transitive dependencies). Input should be JSON with projectPath and vulnerabilities array. Returns JSON array of matches.';

    private llm: BaseChatModel;
    private modelName: string;
    private lockFileService: LockFileService;

    constructor() {
        super();
        this.modelName = process.env.LLM_MODEL || process.env.OLLAMA_CHAT_MODEL || 'llama3:8b';
        this.llm = LLMService.createLLM();
        this.lockFileService = new LockFileService();
    }

    async _call(input: string): Promise<string> {
        console.log(`[LockFileAnalyzerTool] 🔍 Tool called - Input size: ${input.length} chars`);
        const startTime = Date.now();

        try {
            console.log(`[LockFileAnalyzerTool] 📋 Parsing input JSON...`);
            const { projectPath, vulnerabilities } = JSON.parse(input);

            if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
                console.log(`[LockFileAnalyzerTool] ⚠️  No vulnerabilities provided, returning empty array`);
                return '[]';
            }

            console.log(`[LockFileAnalyzerTool] 📊 Starting lock file analysis for ${vulnerabilities.length} vulnerability(ies) in project: ${projectPath}`);

            // Read and chunk lock file
            console.log(`[LockFileAnalyzerTool] 📂 Reading lock file from project path...`);
            const readStart = Date.now();
            const chunks = await this.lockFileService.readAndChunkLockFile(projectPath);
            const readDuration = Date.now() - readStart;
            console.log(`[LockFileAnalyzerTool] ✅ Lock file read and split into ${chunks.length} chunk(s) in ${readDuration}ms`);

            // Analyze each chunk
            const allMatches: VulnerabilityMatch[] = [];

            for (const chunk of chunks) {
                console.log(`[LockFileAnalyzerTool] 🔄 [${chunk.chunkIndex + 1}/${chunk.totalChunks}] Starting analysis of chunk ${chunk.chunkIndex + 1} (size: ${chunk.content.length} chars)...`);
                const chunkStart = Date.now();
                const chunkMatches = await this.analyzeChunk(chunk, vulnerabilities, projectPath);
                const chunkDuration = Date.now() - chunkStart;
                console.log(`[LockFileAnalyzerTool] ✅ [${chunk.chunkIndex + 1}/${chunk.totalChunks}] Chunk analysis completed in ${chunkDuration}ms - Found ${chunkMatches.length} match(es)`);
                allMatches.push(...chunkMatches);
            }

            // Merge and deduplicate matches
            console.log(`[LockFileAnalyzerTool] 🔄 Merging and deduplicating ${allMatches.length} match(es)...`);
            const mergeStart = Date.now();
            const merged = this.mergeMatches(allMatches);
            const mergeDuration = Date.now() - mergeStart;
            console.log(`[LockFileAnalyzerTool] ✅ Merged to ${merged.length} unique match(es) in ${mergeDuration}ms`);

            const result = JSON.stringify(merged, null, 2);
            const totalDuration = Date.now() - startTime;
            console.log(`[LockFileAnalyzerTool] ✅ Tool completed in ${totalDuration}ms - Returning ${merged.length} vulnerability match(es)`);

            return result;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error(`[LockFileAnalyzerTool] ❌ Tool failed after ${duration}ms:`, error.message);
            return `Error analyzing lock file: ${error.message}`;
        }
    }

    private async analyzeChunk(
        chunk: LockFileChunk,
        vulnerabilities: ExtractedVulnerability[],
        projectPath: string,
    ): Promise<VulnerabilityMatch[]> {
        console.log(`[LockFileAnalyzerTool] 📝 Preparing LLM prompt for chunk ${chunk.chunkIndex + 1}...`);

        // Format vulnerabilities for the prompt
        const vulnerabilitiesText = vulnerabilities.map(v =>
            `- ${v.packageName}${v.versionRange ? ` (${v.versionRange})` : ''}${v.cveId ? ` - ${v.cveId}` : ''}${v.severity ? ` [${v.severity}]` : ''}`
        ).join('\n');

        const lockFileName = path.basename(projectPath) === 'yarn.lock' ? 'yarn.lock' : 'package-lock.json';

        const prompt = `Analyze the following ${lockFileName} file chunk and check if any of the vulnerable packages listed below are present in the dependency tree (including transitive dependencies).

VULNERABLE PACKAGES TO CHECK:
${vulnerabilitiesText}

${lockFileName} CHUNK (${chunk.chunkIndex + 1} of ${chunk.totalChunks}):
${chunk.content}

For each vulnerable package found in this chunk, provide:
1. Package name
2. Installed version
3. Whether it's a direct dependency or transitive (and if transitive, show the dependency path like ["parent-package", "child-package", "vulnerable-package"])
4. Whether the installed version is vulnerable based on the version range
5. Recommendation for fixing

Return the result as a JSON array. Example format:
[
  {
    "packageName": "lodash",
    "installedVersion": "4.17.15",
    "isDirect": true,
    "isVulnerable": true,
    "dependencyPath": ["lodash"],
    "vulnerableRange": "<4.17.21",
    "cveId": "CVE-2021-23337",
    "severity": "high",
    "recommendation": "Update lodash from 4.17.15 to >=4.17.21"
  }
]

If no vulnerable packages are found in this chunk, return an empty array []. Only return valid JSON, no additional text.`;

        try {
            console.log(`[LockFileAnalyzerTool] 🤖 Calling LLM (${this.modelName}) for chunk ${chunk.chunkIndex + 1} analysis...`);
            const llmStart = Date.now();
            const response = await this.llm.invoke(prompt);
            const llmDuration = Date.now() - llmStart;
            const content = typeof response.content === 'string' ? response.content : String(response.content);
            console.log(`[LockFileAnalyzerTool] 🤖 LLM response received in ${llmDuration}ms for chunk ${chunk.chunkIndex + 1} - Response length: ${content.length} chars`);

            // Extract JSON from response
            console.log(`[LockFileAnalyzerTool] 🔍 Extracting JSON from LLM response for chunk ${chunk.chunkIndex + 1}...`);
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.warn(`[LockFileAnalyzerTool] ⚠️  No JSON array found in LLM response for chunk ${chunk.chunkIndex + 1}`);
                return [];
            }

            console.log(`[LockFileAnalyzerTool] 📋 Parsing extracted JSON for chunk ${chunk.chunkIndex + 1}...`);
            const llmMatches: any[] = JSON.parse(jsonMatch[0]);
            console.log(`[LockFileAnalyzerTool] ✅ Parsed ${llmMatches.length} match(es) from LLM response for chunk ${chunk.chunkIndex + 1}`);

            // Convert to VulnerabilityMatch format
            console.log(`[LockFileAnalyzerTool] 🔄 Converting LLM matches to VulnerabilityMatch format...`);
            const matches: VulnerabilityMatch[] = [];

            for (const llmMatch of llmMatches) {
                const vulnerability = vulnerabilities.find(
                    v => v.packageName.toLowerCase() === llmMatch.packageName.toLowerCase()
                );

                if (vulnerability) {
                    matches.push({
                        vulnerability,
                        projectDependency: {
                            name: llmMatch.packageName,
                            version: llmMatch.installedVersion,
                            type: llmMatch.isDirect ? 'dependency' : 'transitive',
                            via: llmMatch.dependencyPath || [],
                        },
                        isVulnerable: llmMatch.isVulnerable,
                        isTransitive: !llmMatch.isDirect,
                        reason: llmMatch.isVulnerable
                            ? `Package ${llmMatch.packageName}@${llmMatch.installedVersion} ${llmMatch.isDirect ? '(direct)' : '(transitive)'} is vulnerable (affected versions: ${llmMatch.vulnerableRange || 'all'})`
                            : `Package ${llmMatch.packageName}@${llmMatch.installedVersion} is not vulnerable`,
                        recommendation: llmMatch.recommendation || 'Update to a secure version',
                    });
                }
            }

            console.log(`[LockFileAnalyzerTool] ✅ Converted ${matches.length} match(es) to VulnerabilityMatch format for chunk ${chunk.chunkIndex + 1}`);
            return matches;
        } catch (error: any) {
            console.error(`[LockFileAnalyzerTool] ❌ Failed to analyze chunk ${chunk.chunkIndex + 1}:`, error.message);
            return [];
        }
    }

    private mergeMatches(matches: VulnerabilityMatch[]): VulnerabilityMatch[] {
        // Deduplicate by package name and version
        const seen = new Map<string, VulnerabilityMatch>();

        for (const match of matches) {
            const key = `${match.projectDependency.name.toLowerCase()}_${match.projectDependency.version}`;
            if (!seen.has(key)) {
                seen.set(key, match);
            } else {
                // Keep the one with more information (e.g., has dependency path)
                const existing = seen.get(key)!;
                if (match.projectDependency.via && match.projectDependency.via.length > 0 &&
                    (!existing.projectDependency.via || existing.projectDependency.via.length === 0)) {
                    seen.set(key, match);
                }
            }
        }

        return Array.from(seen.values());
    }
}

