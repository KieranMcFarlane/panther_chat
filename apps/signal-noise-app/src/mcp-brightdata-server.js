#!/usr/bin/env node

/**
 * BrightData MCP Server
 * Provides MCP tools for web scraping and search capabilities using BrightData
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

let Server;
let StdioServerTransport;
let CallToolRequestSchema;
let ListToolsRequestSchema;

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

async function runBrightDataSdk(method, payload) {
  const pythonCode = String.raw`
import asyncio
import json
import os
import sys
from pathlib import Path

repo_root = Path(sys.argv[2])
sys.path.insert(0, str(repo_root))

from backend.brightdata_sdk_client import BrightDataSDKClient

async def main():
    payload = json.loads(sys.argv[1])
    client = BrightDataSDKClient()
    try:
        if sys.argv[3] == "search_engine":
            result = await client.search_engine(
                query=payload.get("query", ""),
                engine=payload.get("engine", "google"),
                country=payload.get("country", "us"),
                num_results=int(payload.get("num_results", 10) or 10),
            )
        elif sys.argv[3] == "scrape_as_markdown":
            result = await client.scrape_as_markdown(payload.get("url", ""))
        elif sys.argv[3] == "scrape_batch":
            result = await client.scrape_batch(payload.get("urls", []))
        else:
            raise RuntimeError(f"Unsupported BrightData SDK method: {sys.argv[3]}")
        print(json.dumps(result))
    finally:
        await client.close()

asyncio.run(main())
`;

  const { stdout } = await execFileAsync(
    'python3',
    ['-c', pythonCode, JSON.stringify(payload), APP_ROOT, method],
    {
      env: {
        ...process.env,
        PYTHONPATH: APP_ROOT,
      },
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  return JSON.parse(String(stdout || '{}').trim() || '{}');
}

async function loadMcpSdk() {
  ({
    Server,
  } = await import('@modelcontextprotocol/sdk/server/index.js'));
  ({
    StdioServerTransport,
  } = await import('@modelcontextprotocol/sdk/server/stdio.js'));
  ({
    CallToolRequestSchema,
    ListToolsRequestSchema,
  } = await import('@modelcontextprotocol/sdk/types.js'));
}

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
    try {
      const data = await runBrightDataSdk('search_engine', {
        query,
        engine,
        country: 'us',
        num_results: 10,
        cursor,
      });

      const results = Array.isArray(data.results) ? data.results : [];
      let resultsText = `Search results for "${query}" on ${engine}:\n\n`;
      results.forEach((result, index) => {
        resultsText += `${index + 1}. ${result.title || 'Untitled'}\n`;
        resultsText += `   URL: ${result.url || ''}\n`;
        resultsText += `   Description: ${result.snippet || 'No description available'}\n\n`;
      });
      if (data.metadata?.source) {
        resultsText += `\nSource: ${data.metadata.source}\n`;
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
    try {
      const data = await runBrightDataSdk('scrape_as_markdown', { url });
      const processedContent = String(data.content || data.markdown || data.text || '');
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
    const results = [];
    for (const url of urls) {
      try {
        const result = await runBrightDataSdk('scrape_as_markdown', { url });
        results.push({
          url,
          success: true,
          content: String(result.content || result.markdown || result.text || ''),
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
async function main() {
  await loadMcpSdk();
  const server = new BrightDataMCPServer();
  await server.run();
}

main().catch(console.error);
