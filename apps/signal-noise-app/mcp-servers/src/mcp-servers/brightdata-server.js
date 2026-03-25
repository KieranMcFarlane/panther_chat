#!/usr/bin/env node

/**
 * BrightData MCP Server
 * Provides web search and scraping capabilities as MCP tools.
 *
 * This implementation talks directly to BrightData's HTTP API and exposes
 * canonical MCP tools for the rest of the pipeline.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'brightdata-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN || process.env.BRIGHTDATA_TOKEN || '';
const BRIGHTDATA_API_URL = process.env.BRIGHTDATA_API_URL || 'https://api.brightdata.com';
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE || '';

function toolText(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  };
}

function toolError(message, extra = {}) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          status: 'error',
          error: message,
          ...extra,
        }),
      },
    ],
    isError: true,
  };
}

function ensureCredentials() {
  if (!BRIGHTDATA_API_TOKEN || !BRIGHTDATA_ZONE) {
    throw new Error('BrightData credentials not configured. Please set BRIGHTDATA_API_TOKEN/BRIGHTDATA_TOKEN and BRIGHTDATA_ZONE.');
  }
}

function normalizeSearchResults(data) {
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return organic.map((result, index) => ({
    position: index + 1,
    title: result.title || '',
    url: result.link || result.url || '',
    description: result.description || result.snippet || '',
    snippet: result.snippet || result.description || '',
  }));
}

function buildSearchQuery(query, engine, country, language, numResults, cursor) {
  const params = new URLSearchParams({
    query,
    num_results: String(numResults ?? 10),
    api_key: BRIGHTDATA_API_TOKEN,
    country: country || 'us',
    language: language || 'en',
  });
  if (cursor) {
    params.append('cursor', cursor);
  }
  return `${BRIGHTDATA_API_URL}/serp/${engine}?${params}`;
}

async function brightdataSearchEngine({
  query,
  engine = 'google',
  country = 'us',
  language = 'en',
  numResults = 10,
  cursor,
}) {
  ensureCredentials();

  const searchUrl = buildSearchQuery(query, engine, country, language, numResults, cursor);
  const response = await fetch(searchUrl, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    status: 'success',
    tool: 'search_engine',
    query,
    engine,
    country,
    language,
    num_results: numResults,
    cursor: data?.cursor || null,
    results: normalizeSearchResults(data),
    search_information: data?.search_information || null,
    related_searches: Array.isArray(data?.related_searches)
      ? data.related_searches.slice(0, 10).map((related) => ({
          query: related.query || related.text || '',
        }))
      : [],
    source: 'brightdata-mcp-server',
  };
}

async function brightdataScrapeAsMarkdown({ url }) {
  ensureCredentials();

  const scrapeUrl = `${BRIGHTDATA_API_URL}/scrape`;
  const params = new URLSearchParams({
    url,
    format: 'markdown',
    api_key: BRIGHTDATA_API_TOKEN,
    country: 'us',
    language: 'en',
  });

  const response = await fetch(`${scrapeUrl}?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`BrightData scrape error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = String(data?.content || data?.markdown || data?.text || '');
  if (!content) {
    throw new Error('No content returned from scraping service');
  }

  return {
    status: 'success',
    tool: 'scrape_as_markdown',
    url,
    content,
    metadata: {
      word_count: content.split(/\s+/).filter(Boolean).length,
      source: 'brightdata-mcp-server',
    },
    source: 'brightdata-mcp-server',
  };
}

async function brightdataScrapeBatch({ urls }) {
  ensureCredentials();

  const limitedUrls = Array.isArray(urls) ? urls.slice(0, 10) : [];
  const results = [];
  for (const url of limitedUrls) {
    try {
      const result = await brightdataScrapeAsMarkdown({ url });
      results.push({
        url,
        success: true,
        content: result.content,
        metadata: result.metadata,
      });
    } catch (error) {
      results.push({
        url,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    status: 'success',
    tool: 'scrape_batch',
    total_urls: limitedUrls.length,
    successful: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
    source: 'brightdata-mcp-server',
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_engine',
      description: 'Search Google, Bing, or Yandex via BrightData for facts, RFPs, tenders, and procurement signals',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          engine: { type: 'string', enum: ['google', 'bing', 'yandex'], default: 'google' },
          country: { type: 'string', default: 'us' },
          language: { type: 'string', default: 'en' },
          numResults: { type: 'number', default: 10 },
          cursor: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'scrape_as_markdown',
      description: 'Scrape a webpage and return markdown content',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', description: 'URL to scrape' },
        },
        required: ['url'],
      },
    },
    {
      name: 'scrape_batch',
      description: 'Scrape multiple webpages',
      inputSchema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ['urls'],
      },
    },
    {
      name: 'session_stats',
      description: 'Return BrightData MCP configuration and readiness state',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'brightdata_search_google',
      description: 'Legacy alias for search_engine',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          country: { type: 'string', default: 'us' },
          language: { type: 'string', default: 'en' },
          numResults: { type: 'number', default: 10 },
        },
        required: ['query'],
      },
    },
    {
      name: 'brightdata_scrape_webpage',
      description: 'Legacy alias for scrape_as_markdown',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
        },
        required: ['url'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_engine':
      case 'brightdata_search_google':
        return toolText(await brightdataSearchEngine(args || {}));

      case 'scrape_as_markdown':
      case 'brightdata_scrape_webpage':
        return toolText(await brightdataScrapeAsMarkdown(args || {}));

      case 'scrape_batch':
        return toolText(await brightdataScrapeBatch(args || {}));

      case 'session_stats':
        return toolText({
          status: 'success',
          configured: Boolean(BRIGHTDATA_API_TOKEN && BRIGHTDATA_ZONE),
          token_set: Boolean(BRIGHTDATA_API_TOKEN),
          zone_set: Boolean(BRIGHTDATA_ZONE),
          api_url: BRIGHTDATA_API_URL,
          source: 'brightdata-mcp-server',
        });

      default:
        return toolError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return toolError(error.message, { tool: name });
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('BrightData MCP server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
