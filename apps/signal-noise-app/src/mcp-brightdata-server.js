#!/usr/bin/env node

/**
 * BrightData MCP Server
 * Provides MCP tools for web scraping and search capabilities using BrightData
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class BrightDataMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'brightdata-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_engine',
          description: 'Search Google, Bing or Yandex for RFP opportunities and procurement information',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for finding RFPs and procurement opportunities',
              },
              engine: {
                type: 'string',
                enum: ['google', 'bing', 'yandex'],
                default: 'google',
                description: 'Search engine to use',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              }
            },
            required: ['query'],
          },
        },
        {
          name: 'scrape_as_markdown',
          description: 'Scrape a webpage and extract content as markdown format',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                format: 'uri',
                description: 'URL to scrape for RFP details and procurement information',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'scrape_batch',
          description: 'Scrape multiple webpages simultaneously for efficient RFP discovery',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'uri',
                },
                minItems: 1,
                maxItems: 10,
                description: 'Array of URLs to scrape for RFP information (max 10)',
              },
            },
            required: ['urls'],
          },
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_engine':
            return await this.handleSearchEngine(args);
          case 'scrape_as_markdown':
            return await this.handleScrapeAsMarkdown(args);
          case 'scrape_batch':
            return await this.handleScrapeBatch(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async handleSearchEngine(args) {
    const { query, engine = 'google', cursor } = args;
    
    if (!process.env.BRIGHTDATA_TOKEN || !process.env.BRIGHTDATA_ZONE) {
      throw new Error('BrightData credentials not configured. Please set BRIGHTDATA_TOKEN and BRIGHTDATA_ZONE environment variables.');
    }

    console.log(`Searching ${engine} for: ${query}`);
    
    // Construct BrightData search API URL
    const searchUrl = `https://api.brightdata.com/serp/${engine}`;
    const params = new URLSearchParams({
      query,
      num_results: '10',
      api_key: process.env.BRIGHTDATA_TOKEN,
      country: 'us',
      language: 'en'
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    try {
      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Format results for RFP scanning
      let resultsText = `Search results for "${query}" on ${engine}:\n\n`;
      
      if (data.organic_results && Array.isArray(data.organic_results)) {
        data.organic_results.forEach((result, index) => {
          resultsText += `${index + 1}. ${result.title}\n`;
          resultsText += `   URL: ${result.link}\n`;
          resultsText += `   Description: ${result.description || 'No description available'}\n\n`;
        });
      }

      if (data.search_information) {
        resultsText += `\nSearch completed in ${data.search_information.time_taken_displayed}s\n`;
      }

      if (data.related_searches && data.related_searches.length > 0) {
        resultsText += `\nRelated searches for RFP discovery:\n`;
        data.related_searches.slice(0, 5).forEach(related => {
          resultsText += `- ${related.query}\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: resultsText,
          },
        ],
      };
    } catch (error) {
      console.error('BrightData search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async handleScrapeAsMarkdown(args) {
    const { url } = args;
    
    if (!process.env.BRIGHTDATA_TOKEN || !process.env.BRIGHTDATA_ZONE) {
      throw new Error('BrightData credentials not configured. Please set BRIGHTDATA_TOKEN and BRIGHTDATA_ZONE environment variables.');
    }

    console.log(`Scraping URL: ${url}`);
    
    try {
      // Use BrightData scraping API
      const scrapeUrl = `https://api.brightdata.com/scrape`;
      const params = new URLSearchParams({
        url,
        format: 'markdown',
        api_key: process.env.BRIGHTDATA_TOKEN,
        country: 'us',
        language: 'en'
      });

      const response = await fetch(`${scrapeUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`BrightData scrape error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No content returned from scraping service');
      }

      // Extract RFP-relevant information
      let processedContent = data.content;
      
      // Look for RFP-specific keywords and highlight them
      const rfpKeywords = [
        'request for proposal', 'RFP', 'tender', 'procurement', 
        'bid deadline', 'submission', 'vendor', 'supplier',
        'contract opportunity', 'solicitation'
      ];
      
      rfpKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        processedContent = processedContent.replace(regex, '**$1**');
      });

      const resultText = `Content scraped from ${url}:\n\n${processedContent}\n\n---\nScraped at: ${new Date().toISOString()}`;

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      console.error('BrightData scrape error:', error);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  async handleScrapeBatch(args) {
    const { urls } = args;
    
    if (!process.env.BRIGHTDATA_TOKEN || !process.env.BRIGHTDATA_ZONE) {
      throw new Error('BrightData credentials not configured. Please set BRIGHTDATA_TOKEN and BRIGHTDATA_ZONE environment variables.');
    }

    console.log(`Batch scraping ${urls.length} URLs`);
    
    const results = [];
    
    for (const url of urls) {
      try {
        // Reuse single scrape logic for each URL
        const result = await this.handleScrapeAsMarkdown({ url });
        results.push({
          url,
          success: true,
          content: result.content[0].text,
        });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error.message,
        });
      }
    }

    let batchResultText = `Batch scraping completed for ${urls.length} URLs:\n\n`;
    
    results.forEach((result, index) => {
      batchResultText += `${index + 1}. ${result.url}\n`;
      if (result.success) {
        batchResultText += `   ✅ Successfully scraped\n`;
        batchResultText += `   Content preview: ${result.content.substring(0, 200)}...\n\n`;
      } else {
        batchResultText += `   ❌ Failed: ${result.error}\n\n`;
      }
    });

    const successfulScrapes = results.filter(r => r.success).length;
    batchResultText += `\nSummary: ${successfulScrapes}/${urls.length} URLs successfully scraped`;

    return {
      content: [
        {
          type: 'text',
          text: batchResultText,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BrightData MCP server running on stdio');
  }
}

// Run the server
const server = new BrightDataMCPServer();
server.run().catch(console.error);