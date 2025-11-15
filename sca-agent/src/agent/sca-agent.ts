import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ForumScraperTool } from './tools/forum-scraper.tool';
import { VulnerabilityExtractorTool } from './tools/vulnerability-extractor.tool';
import { LockFileAnalyzerTool } from './tools/lock-file-analyzer.tool';
import { RAGStorageTool } from './tools/rag-storage.tool';
import { LLMService } from '../services/llm.service';
import { SCAScanRequest, SCAScanResult } from '../types/sca.types';

/**
 * SCA Agent that orchestrates vulnerability scanning workflow
 */
export class SCAAgent {
  private agentExecutor?: AgentExecutor;
  private llm?: BaseChatModel;
  private tools?: any[];
  private ragApiUrl?: string;

  constructor(ragApiUrl?: string) {
    this.ragApiUrl = ragApiUrl;
    // Note: Agent initialization is async, but we can't make constructor async
    // So we'll initialize the executor lazily on first use
  }

  private async initializeAgent(): Promise<void> {
    console.log('[SCAAgent] 🔧 Initializing SCA Agent...');

    // Initialize LLM
    this.llm = LLMService.createLLM();

    // Initialize tools
    this.tools = [
      new ForumScraperTool(),
      new VulnerabilityExtractorTool(),
      new LockFileAnalyzerTool(),
      new RAGStorageTool(this.ragApiUrl),
    ];

    console.log(`[SCAAgent] 🔧 Initialized ${this.tools.length} tools`);

    // Create agent prompt - ReAct agent needs specific format
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `You are a Software Composition Analysis (SCA) agent that helps identify security vulnerabilities in software projects.

Your workflow:
1. Use forum_scraper to scrape forum messages from provided URLs
2. Use vulnerability_extractor to extract structured vulnerability data (package name, CVE ID, version range, severity) from the scraped messages
3. Use lock_file_analyzer to analyze project lock files (yarn.lock or package-lock.json) to check if vulnerable packages exist
4. Use rag_storage to store findings in RAG for future reference

Always use the tools in sequence. Be thorough and accurate.

You have access to the following tools:
{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`],
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    // Create agent using ReAct pattern (works with any LLM)
    const agent = await createReactAgent({
      llm: this.llm,
      tools: this.tools,
      prompt,
    });

    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true,
      maxIterations: 15,
    });

    console.log('[SCAAgent] ✅ SCA Agent initialized');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.agentExecutor) {
      await this.initializeAgent();
    }
  }

  /**
   * Run SCA scan on a project
   * Uses tools directly in sequence for reliability
   */
  async scan(request: SCAScanRequest): Promise<SCAScanResult> {
    await this.ensureInitialized();

    console.log(`[SCAAgent] 🔍 Starting SCA scan...`);
    console.log(`[SCAAgent] 📋 Forum URLs: ${request.forumUrls.length}`);
    console.log(`[SCAAgent] 📂 Project path: ${request.projectPath}`);

    const startTime = Date.now();

    try {
      if (!this.tools) {
        throw new Error('Tools not initialized');
      }

      const forumScraper = this.tools.find(t => t.name === 'forum_scraper');
      const vulnerabilityExtractor = this.tools.find(t => t.name === 'vulnerability_extractor');
      const lockFileAnalyzer = this.tools.find(t => t.name === 'lock_file_analyzer');
      const ragStorage = this.tools.find(t => t.name === 'rag_storage');

      if (!forumScraper || !vulnerabilityExtractor || !lockFileAnalyzer || !ragStorage) {
        throw new Error('Required tools not found');
      }

      // Step 1: Scrape forum
      console.log(`[SCAAgent] Step 1/4: Scraping forum messages...`);
      const forumUrlsStr = request.forumUrls.join(',');
      const scrapedMessagesJson = await forumScraper.call(forumUrlsStr);
      const scrapedMessages = JSON.parse(scrapedMessagesJson);
      console.log(`[SCAAgent] ✅ Scraped ${scrapedMessages.length} forum message(s)`);

      // Step 2: Extract vulnerabilities
      console.log(`[SCAAgent] Step 2/4: Extracting vulnerabilities...`);
      const vulnerabilitiesJson = await vulnerabilityExtractor.call(scrapedMessagesJson);
      const vulnerabilities = JSON.parse(vulnerabilitiesJson);
      console.log(`[SCAAgent] ✅ Extracted ${vulnerabilities.length} vulnerability(ies)`);

      // Step 3: Analyze lock file
      console.log(`[SCAAgent] Step 3/4: Analyzing lock file...`);
      const lockFileInput = JSON.stringify({
        projectPath: request.projectPath,
        vulnerabilities: vulnerabilities,
      });
      const matchesJson = await lockFileAnalyzer.call(lockFileInput);
      const matches = JSON.parse(matchesJson);
      console.log(`[SCAAgent] ✅ Found ${matches.length} vulnerability match(es)`);

      // Step 4: Store in RAG
      console.log(`[SCAAgent] Step 4/4: Storing in RAG...`);
      const storageInput = JSON.stringify({
        action: 'store',
        data: {
          vulnerabilities: vulnerabilities,
          matches: matches,
        },
      });
      await ragStorage.call(storageInput);
      console.log(`[SCAAgent] ✅ Stored in RAG`);

      // Generate report
      const vulnerableMatches = matches.filter((m: any) => m.isVulnerable);
      const severityBreakdown = {
        critical: vulnerableMatches.filter((m: any) => (m.vulnerability.severity || '').toLowerCase() === 'critical').length,
        high: vulnerableMatches.filter((m: any) => (m.vulnerability.severity || '').toLowerCase() === 'high').length,
        medium: vulnerableMatches.filter((m: any) => (m.vulnerability.severity || '').toLowerCase() === 'medium').length,
        low: vulnerableMatches.filter((m: any) => (m.vulnerability.severity || '').toLowerCase() === 'low').length,
      };

      const recommendations = vulnerableMatches.map((m: any) => m.recommendation);

      const duration = Date.now() - startTime;
      console.log(`[SCAAgent] ✅ Scan completed in ${duration}ms`);

      const scanResult: SCAScanResult = {
        vulnerabilities,
        matches,
        report: {
          scanDate: new Date().toISOString(),
          totalVulnerabilitiesFound: vulnerabilities.length,
          vulnerablePackagesInProject: vulnerableMatches.length,
          severityBreakdown,
          recommendations,
          summary: `Found ${vulnerabilities.length} vulnerability(ies) from forum sources. ${vulnerableMatches.length} vulnerable package(s) detected in project. ${recommendations.length > 0 ? 'Recommendations: ' + recommendations.join('; ') : ''}`,
        },
      };

      // Report generation is handled by the API service
      return scanResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SCAAgent] ❌ Scan failed after ${duration}ms:`, error.message);
      throw error;
    }
  }
}

