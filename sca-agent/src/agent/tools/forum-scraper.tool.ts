import { Tool } from '@langchain/core/tools';
import { ForumScraperService } from '../../services/forum-scraper.service';
import { ForumMessage } from '../../types/sca.types';

export class ForumScraperTool extends Tool {
  name = 'forum_scraper';
  description = 'Scrapes forum messages from URLs. Input should be a comma-separated list of URLs to security advisories or forum posts. Returns structured forum message data including title, content, author, and date.';

  private scraper: ForumScraperService;

  constructor() {
    super();
    this.scraper = new ForumScraperService();
  }

  async _call(input: string): Promise<string> {
    console.log(`[ForumScraperTool] 🔍 Tool called with input: ${input.substring(0, 100)}...`);
    const startTime = Date.now();
    
    try {
      // Parse comma-separated URLs
      const urls = input.split(',').map(url => url.trim()).filter(url => url.length > 0);
      
      if (urls.length === 0) {
        console.log(`[ForumScraperTool] ❌ No valid URLs provided`);
        return 'Error: No valid URLs provided';
      }

      console.log(`[ForumScraperTool] 📋 Parsed ${urls.length} URL(s) from input`);
      const messages = await this.scraper.scrapeUrls(urls);
      
      const result = JSON.stringify(messages, null, 2);
      const duration = Date.now() - startTime;
      console.log(`[ForumScraperTool] ✅ Tool completed in ${duration}ms - Returning ${messages.length} forum message(s)`);
      
      // Return as JSON string for LLM to parse
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[ForumScraperTool] ❌ Tool failed after ${duration}ms:`, error.message);
      return `Error scraping forum messages: ${error.message}`;
    }
  }
}

