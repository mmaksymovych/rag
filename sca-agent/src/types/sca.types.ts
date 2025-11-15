export interface ForumMessage {
  url: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
}

export interface ExtractedVulnerability {
  packageName: string;
  versionRange?: string;
  cveId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  sourceUrl: string;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'transitive';
  via?: string[];
}

export interface VulnerabilityMatch {
  vulnerability: ExtractedVulnerability;
  projectDependency: ProjectDependency;
  isVulnerable: boolean;
  reason: string;
  recommendation: string;
  isTransitive?: boolean;
}

export interface SCAScanRequest {
  forumUrls: string[];
  projectPath: string;
}

export interface SCAScanResult {
  vulnerabilities: ExtractedVulnerability[];
  matches: VulnerabilityMatch[];
  report: RiskAssessmentReport;
}

export interface RiskAssessmentReport {
  scanDate: string;
  totalVulnerabilitiesFound: number;
  vulnerablePackagesInProject: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  summary: string;
}

