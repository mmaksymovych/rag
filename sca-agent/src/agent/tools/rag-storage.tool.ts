import { Tool } from '@langchain/core/tools';
import axios from 'axios';
import { ExtractedVulnerability, VulnerabilityMatch } from '../../types/sca.types';

export class RAGStorageTool extends Tool {
  name = 'rag_storage';
  description = 'Stores and retrieves vulnerability information in RAG system. Can store vulnerabilities with their status, or search for previously stored vulnerabilities. Input should be JSON with action ("store" or "search") and data.';

  private ragApiUrl: string;

  constructor(ragApiUrl?: string) {
    super();
    this.ragApiUrl = ragApiUrl || process.env.RAG_API_URL || 'http://localhost:3000';
    console.log(`[RAGStorageTool] 🔧 Initializing with RAG API URL: ${this.ragApiUrl}`);
  }

  async _call(input: string): Promise<string> {
    console.log(`[RAGStorageTool] 🔍 Tool called - Input size: ${input.length} chars`);
    const startTime = Date.now();

    try {
      const { action, data } = JSON.parse(input);

      if (action === 'store') {
        return await this.storeVulnerabilities(data);
      } else if (action === 'search') {
        return await this.searchVulnerabilities(data);
      } else {
        throw new Error(`Unknown action: ${action}. Use "store" or "search"`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[RAGStorageTool] ❌ Tool failed after ${duration}ms:`, error.message);
      return `Error in RAG storage: ${error.message}`;
    }
  }

  /**
   * Store vulnerabilities in RAG
   */
  private async storeVulnerabilities(data: {
    vulnerabilities?: ExtractedVulnerability[];
    matches?: VulnerabilityMatch[];
  }): Promise<string> {
    console.log(`[RAGStorageTool] 📦 Storing vulnerabilities in RAG...`);
    const storeStart = Date.now();

    const stored: any[] = [];

    // Store individual vulnerabilities
    if (data.vulnerabilities && data.vulnerabilities.length > 0) {
      console.log(`[RAGStorageTool] 📦 Storing ${data.vulnerabilities.length} vulnerability(ies)...`);
      for (const vuln of data.vulnerabilities) {
        const text = this.formatVulnerabilityForStorage(vuln);
        const metadata = {
          type: 'vulnerability',
          packageName: vuln.packageName,
          cveId: vuln.cveId,
          severity: vuln.severity,
          versionRange: vuln.versionRange,
          sourceUrl: vuln.sourceUrl,
          storedAt: new Date().toISOString(),
        };

        try {
          const response = await axios.post(`${this.ragApiUrl}/text/submit`, {
            text,
            metadata,
          });

          stored.push({
            type: 'vulnerability',
            packageName: vuln.packageName,
            cveId: vuln.cveId,
            sourceId: response.data.sourceId,
          });
          console.log(`[RAGStorageTool] ✅ Stored vulnerability: ${vuln.packageName}${vuln.cveId ? ` (${vuln.cveId})` : ''} - Source ID: ${response.data.sourceId}`);
        } catch (error: any) {
          const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
          console.error(`[RAGStorageTool] ❌ Failed to store vulnerability ${vuln.packageName}:`, errorMsg);
          if (error.response) {
            console.error(`[RAGStorageTool] Response status: ${error.response.status}, data:`, JSON.stringify(error.response.data));
          }
        }
      }
    }

    // Store vulnerability matches (with project status)
    if (data.matches && data.matches.length > 0) {
      console.log(`[RAGStorageTool] 📦 Storing ${data.matches.length} vulnerability match(es)...`);
      for (const match of data.matches) {
        const text = this.formatMatchForStorage(match);
        const metadata = {
          type: 'vulnerability_match',
          packageName: match.projectDependency.name,
          version: match.projectDependency.version,
          cveId: match.vulnerability.cveId,
          severity: match.vulnerability.severity,
          isVulnerable: match.isVulnerable,
          isTransitive: match.isTransitive,
          dependencyPath: match.projectDependency.via || [],
          recommendation: match.recommendation,
          storedAt: new Date().toISOString(),
        };

        try {
          const response = await axios.post(`${this.ragApiUrl}/text/submit`, {
            text,
            metadata,
          });

          stored.push({
            type: 'vulnerability_match',
            packageName: match.projectDependency.name,
            version: match.projectDependency.version,
            cveId: match.vulnerability.cveId,
            sourceId: response.data.sourceId,
          });
          console.log(`[RAGStorageTool] ✅ Stored match: ${match.projectDependency.name}@${match.projectDependency.version} - Source ID: ${response.data.sourceId}`);
        } catch (error: any) {
          const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
          console.error(`[RAGStorageTool] ❌ Failed to store match ${match.projectDependency.name}:`, errorMsg);
          if (error.response) {
            console.error(`[RAGStorageTool] Response status: ${error.response.status}, data:`, JSON.stringify(error.response.data));
          }
        }
      }
    }

    const storeDuration = Date.now() - storeStart;
    console.log(`[RAGStorageTool] ✅ Stored ${stored.length} item(s) in RAG in ${storeDuration}ms`);

    return JSON.stringify({
      success: true,
      stored: stored.length,
      items: stored,
    }, null, 2);
  }

  /**
   * Search for vulnerabilities in RAG
   */
  private async searchVulnerabilities(data: {
    query: string;
    topK?: number;
  }): Promise<string> {
    console.log(`[RAGStorageTool] 🔍 Searching RAG for: "${data.query}"...`);
    const searchStart = Date.now();

    try {
      const topK = data.topK || 5;
      const response = await axios.post(`${this.ragApiUrl}/chat`, {
        query: data.query,
        topK,
      });

      const searchDuration = Date.now() - searchStart;
      console.log(`[RAGStorageTool] ✅ Search completed in ${searchDuration}ms - Found ${response.data.sources?.length || 0} source(s)`);

      return JSON.stringify({
        success: true,
        response: response.data.response,
        sources: response.data.sources || [],
        context: response.data.context || [],
      }, null, 2);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      console.error(`[RAGStorageTool] ❌ Search failed:`, errorMsg);
      if (error.response) {
        console.error(`[RAGStorageTool] Response status: ${error.response.status}, data:`, JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  /**
   * Format vulnerability for storage in RAG
   */
  private formatVulnerabilityForStorage(vuln: ExtractedVulnerability): string {
    return `Vulnerability: ${vuln.packageName}
${vuln.cveId ? `CVE ID: ${vuln.cveId}` : ''}
${vuln.severity ? `Severity: ${vuln.severity.toUpperCase()}` : ''}
${vuln.versionRange ? `Affected Versions: ${vuln.versionRange}` : ''}
Description: ${vuln.description}
${vuln.sourceUrl ? `Source: ${vuln.sourceUrl}` : ''}`;
  }

  /**
   * Format vulnerability match for storage in RAG
   */
  private formatMatchForStorage(match: VulnerabilityMatch): string {
    return `Vulnerability Match: ${match.projectDependency.name}@${match.projectDependency.version}
${match.vulnerability.cveId ? `CVE ID: ${match.vulnerability.cveId}` : ''}
${match.vulnerability.severity ? `Severity: ${match.vulnerability.severity.toUpperCase()}` : ''}
Type: ${match.isTransitive ? 'Transitive Dependency' : 'Direct Dependency'}
${match.projectDependency.via && match.projectDependency.via.length > 0 ? `Dependency Path: ${match.projectDependency.via.join(' -> ')}` : ''}
Vulnerable: ${match.isVulnerable ? 'YES' : 'NO'}
Reason: ${match.reason}
Recommendation: ${match.recommendation}`;
  }
}

