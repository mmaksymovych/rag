import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { SCAAgent } from './agent/sca-agent';
import { ReportGeneratorService } from './services/report-generator.service';
import { SCAScanRequest, SCAScanResult } from './types/sca.types';
import * as fs from 'fs/promises';
import * as path from 'path';

const app = express();
const port = process.env.PORT || 4000;
const ragApiUrl = process.env.RAG_API_URL || 'http://localhost:3000';

app.use(express.json());

// Initialize agent
const scaAgent = new SCAAgent(ragApiUrl);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sca-agent' });
});

// SCA scan endpoint
app.post('/sca/scan', async (req, res) => {
  try {
    console.log('[Server] Received SCA scan request');

    const { forumUrls, projectPath } = req.body;

    if (!forumUrls || !Array.isArray(forumUrls) || forumUrls.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: forumUrls must be a non-empty array',
      });
    }

    if (!projectPath || typeof projectPath !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: projectPath must be a string',
      });
    }

    const scanRequest: SCAScanRequest = {
      forumUrls,
      projectPath,
    };

    console.log(`[Server] Starting scan for ${forumUrls.length} forum URL(s), project: ${projectPath}`);
    const startTime = Date.now();

    const result: SCAScanResult = await scaAgent.scan(scanRequest);

    const duration = Date.now() - startTime;
    console.log(`[Server] Scan completed in ${duration}ms`);

    // Generate and save markdown report as final step
    console.log(`[Server] 📝 Generating markdown security report...`);
    const reportGenerator = new ReportGeneratorService();
    const reportPath = path.join(projectPath, 'sca-vulnerability-report.md');
    await reportGenerator.generateMarkdownReport(result, reportPath);
    console.log(`[Server] ✅ Security report saved to: ${reportPath}`);

    res.json({
      success: true,
      result,
      duration: `${duration}ms`,
      reportPath: reportPath,
    });
  } catch (error: any) {
    console.error('[Server] Scan error:', error.message);
    res.status(500).json({
      error: 'Scan failed',
      message: error.message,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[Server] 🚀 SCA Agent API server listening on port ${port}`);
  console.log(`[Server] 📡 RAG API URL: ${ragApiUrl}`);
  console.log(`[Server] 🔗 Health check: http://localhost:${port}/health`);
  console.log(`[Server] 🔗 Scan endpoint: POST http://localhost:${port}/sca/scan`);
});

