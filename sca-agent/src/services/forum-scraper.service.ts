import * as cheerio from 'cheerio';
import axios from 'axios';
import { ForumMessage } from '../types/sca.types';

export class ForumScraperService {
  /**
   * Scrape forum messages from URLs
   */
  async scrapeUrls(urls: string[]): Promise<ForumMessage[]> {
    console.log(`[ForumScraper] Starting to scrape ${urls.length} URL(s)...`);
    const startTime = Date.now();
    const messages: ForumMessage[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        console.log(`[ForumScraper] [${i + 1}/${urls.length}] Scraping: ${url}`);
        const messageStart = Date.now();
        const message = await this.scrapeUrl(url);
        const messageDuration = Date.now() - messageStart;
        console.log(`[ForumScraper] [${i + 1}/${urls.length}] ✅ Successfully scraped in ${messageDuration}ms - Title: "${message.title.substring(0, 50)}...", Content: ${message.content.length} chars`);
        messages.push(message);
      } catch (error: any) {
        console.error(`[ForumScraper] [${i + 1}/${urls.length}] ❌ Failed to scrape ${url}:`, error.message);
        // Continue with other URLs even if one fails
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[ForumScraper] ✅ Completed scraping ${messages.length}/${urls.length} URL(s) in ${totalDuration}ms`);
    return messages;
  }

  private async scrapeUrl(url: string): Promise<ForumMessage> {
    try {
      console.log(`[ForumScraper] Making HTTP request to ${url}...`);
      const requestStart = Date.now();
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SCA-Agent/1.0)',
        },
        timeout: 10000,
      });
      const requestDuration = Date.now() - requestStart;
      console.log(`[ForumScraper] HTTP response received in ${requestDuration}ms - Status: ${response.status}, Size: ${response.data.length} bytes`);

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[ForumScraper] Parsing HTML content...`);
      const parseStart = Date.now();
      const $ = cheerio.load(response.data);

      // Try common forum structures
      const title =
        $('h1').first().text().trim() ||
        $('.post-title').first().text().trim() ||
        $('title').text().trim();

      const content =
        $('article').first().text().trim() ||
        $('.post-content').first().text().trim() ||
        $('.message-content').first().text().trim() ||
        $('main').first().text().trim() ||
        $('body').text().trim();

      const author =
        $('.author').first().text().trim() ||
        $('[itemprop="author"]').first().text().trim() ||
        'Unknown';

      const date =
        $('time').first().attr('datetime') ||
        $('.date').first().text().trim() ||
        new Date().toISOString();

      if (!content || content.length < 50) {
        throw new Error('Insufficient content extracted from forum message');
      }

      const parseDuration = Date.now() - parseStart;
      console.log(`[ForumScraper] HTML parsed in ${parseDuration}ms - Extracted title: "${title.substring(0, 50)}...", content: ${content.length} chars`);

      const result = {
        url,
        title: title || 'Untitled',
        content: content.substring(0, 50000), // Limit content size
        author,
        date,
      };

      console.log(`[ForumScraper] ✅ Successfully extracted forum message data`);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to scrape forum URL ${url}: ${error.message}`);
    }
  }
}

