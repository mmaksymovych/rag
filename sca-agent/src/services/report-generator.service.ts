import { SCAScanResult, ExtractedVulnerability, VulnerabilityMatch } from '../types/sca.types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ReportGeneratorService {
  /**
   * Generate a detailed markdown report from scan results
   */
  async generateMarkdownReport(result: SCAScanResult, outputPath?: string): Promise<string> {
    console.log(`[ReportGenerator] 📝 Generating markdown report...`);
    
    const report = this.formatReport(result);
    
    if (outputPath) {
      await fs.writeFile(outputPath, report, 'utf-8');
      console.log(`[ReportGenerator] ✅ Report saved to: ${outputPath}`);
    }
    
    return report;
  }

  private formatReport(result: SCAScanResult): string {
    const { vulnerabilities, matches, report } = result;
    const vulnerableMatches = matches.filter(m => m.isVulnerable);
    const safeMatches = matches.filter(m => !m.isVulnerable);

    let md = `# Security Vulnerability Scan Report\n\n`;
    
    // Executive Summary
    md += `## Executive Summary\n\n`;
    md += `**Scan Date:** ${new Date(report.scanDate).toLocaleString()}\n\n`;
    md += `**Total Vulnerabilities Found:** ${report.totalVulnerabilitiesFound}\n\n`;
    md += `**Vulnerable Packages in Project:** ${report.vulnerablePackagesInProject}\n\n`;
    md += `**Summary:** ${report.summary}\n\n`;
    md += `---\n\n`;

    // Severity Breakdown
    md += `## Severity Breakdown\n\n`;
    md += `| Severity | Count |\n`;
    md += `|----------|-------|\n`;
    md += `| 🔴 Critical | ${report.severityBreakdown.critical} |\n`;
    md += `| 🟠 High | ${report.severityBreakdown.high} |\n`;
    md += `| 🟡 Medium | ${report.severityBreakdown.medium} |\n`;
    md += `| 🟢 Low | ${report.severityBreakdown.low} |\n\n`;
    md += `---\n\n`;

    // Vulnerabilities Found
    if (vulnerabilities.length > 0) {
      md += `## Vulnerabilities Identified\n\n`;
      
      vulnerabilities.forEach((vuln, index) => {
        md += `### ${index + 1}. ${vuln.packageName}${vuln.cveId ? ` - ${vuln.cveId}` : ''}\n\n`;
        
        if (vuln.severity) {
          const severityEmoji = this.getSeverityEmoji(vuln.severity);
          md += `**Severity:** ${severityEmoji} ${vuln.severity.toUpperCase()}\n\n`;
        }
        
        if (vuln.versionRange) {
          md += `**Affected Versions:** ${vuln.versionRange}\n\n`;
        }
        
        if (vuln.cveId) {
          md += `**CVE ID:** ${vuln.cveId}\n\n`;
        }
        
        md += `**Description:** ${vuln.description}\n\n`;
        
        if (vuln.sourceUrl) {
          md += `**Source:** [${vuln.sourceUrl}](${vuln.sourceUrl})\n\n`;
        }
        
        md += `---\n\n`;
      });
    }

    // Vulnerable Packages in Project
    if (vulnerableMatches.length > 0) {
      md += `## ⚠️ Vulnerable Packages in Project\n\n`;
      md += `The following packages in your project are vulnerable:\n\n`;
      
      vulnerableMatches.forEach((match, index) => {
        const vuln = match.vulnerability;
        md += `### ${index + 1}. ${match.projectDependency.name}@${match.projectDependency.version}\n\n`;
        
        md += `**Status:** 🔴 **VULNERABLE**\n\n`;
        
        if (vuln.severity) {
          const severityEmoji = this.getSeverityEmoji(vuln.severity);
          md += `**Severity:** ${severityEmoji} ${vuln.severity.toUpperCase()}\n\n`;
        }
        
        if (vuln.cveId) {
          md += `**CVE ID:** ${vuln.cveId}\n\n`;
        }
        
        md += `**Type:** ${match.isTransitive ? 'Transitive Dependency' : 'Direct Dependency'}\n\n`;
        
        if (match.projectDependency.via && match.projectDependency.via.length > 1) {
          md += `**Dependency Path:** \`${match.projectDependency.via.join(' → ')}\`\n\n`;
        }
        
        if (vuln.versionRange) {
          md += `**Affected Versions:** ${vuln.versionRange}\n\n`;
        }
        
        md += `**Reason:** ${match.reason}\n\n`;
        
        md += `**Recommendation:** ${match.recommendation}\n\n`;
        
        md += `---\n\n`;
      });
    }

    // Safe Packages
    if (safeMatches.length > 0) {
      md += `## ✅ Safe Packages\n\n`;
      md += `The following packages were checked and are **not vulnerable**:\n\n`;
      
      safeMatches.forEach((match) => {
        md += `- **${match.projectDependency.name}@${match.projectDependency.version}** - ${match.reason}\n`;
      });
      
      md += `\n---\n\n`;
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      md += `### Immediate Actions Required\n\n`;
      
      report.recommendations.forEach((rec, index) => {
        md += `${index + 1}. ${rec}\n`;
      });
      
      md += `\n### General Security Best Practices\n\n`;
      md += `1. **Keep dependencies updated:** Regularly update your dependencies to the latest secure versions\n`;
      md += `2. **Review transitive dependencies:** Use tools like \`npm audit\` or \`yarn audit\` to identify vulnerable transitive dependencies\n`;
      md += `3. **Use dependency resolution:** Consider using npm/yarn resolutions to force secure versions of transitive dependencies\n`;
      md += `4. **Monitor security advisories:** Subscribe to security mailing lists for your dependencies\n`;
      md += `5. **Automate scanning:** Integrate SCA scanning into your CI/CD pipeline\n\n`;
      md += `---\n\n`;
    }

    // Technical Details
    md += `## Technical Details\n\n`;
    md += `### Scan Configuration\n\n`;
    md += `- **Total vulnerabilities scanned:** ${vulnerabilities.length}\n`;
    md += `- **Total packages analyzed:** ${matches.length}\n`;
    md += `- **Vulnerable packages:** ${vulnerableMatches.length}\n`;
    md += `- **Safe packages:** ${safeMatches.length}\n\n`;

    // Footer
    md += `---\n\n`;
    md += `*Report generated by SCA Agent*\n`;
    md += `*For questions or issues, please contact your security team*\n`;

    return md;
  }

  private getSeverityEmoji(severity: string): string {
    const sev = severity.toLowerCase();
    if (sev === 'critical') return '🔴';
    if (sev === 'high') return '🟠';
    if (sev === 'medium') return '🟡';
    if (sev === 'low') return '🟢';
    return '⚪';
  }
}

