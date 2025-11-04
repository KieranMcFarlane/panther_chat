import { createTool } from '@mastra/core/tools';
import { z } from "zod";
import { scrapeAsMarkdown, searchEngine, extractLinkedInProfiles, extractSearchResults } from './brightdata-helper';

export const brightDataTools = {
  scrapeWebsite: createTool({
    id: 'scrape_website',
    description: "Scrape a website for sports data, news, or information using BrightData MCP HTTP bridge",
    inputSchema: z.object({
      url: z.string().url().describe("URL to scrape"),
      format: z.enum(["markdown", "html", "json"]).optional().default("markdown").describe("Format of the scraped content"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.object({
        url: z.string(),
        content: z.string(),
        format: z.string(),
      }).optional(),
      error: z.string().optional(),
    }),
        execute: async ({ url, format = "markdown" }) => {
          try {
            const content = await scrapeAsMarkdown(url);
            return { success: true, data: { url, content, format } };
          } catch (error) {
            return { success: false, error: `BrightData scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        },
  }),

  searchLinkedInProfiles: createTool({
    id: 'search_linkedin_profiles',
    description: "Search LinkedIn profiles for persons of interest using BrightData MCP HTTP bridge",
    inputSchema: z.object({
      query: z.string().describe("Search query for LinkedIn profiles (e.g., 'CEO Arsenal FC')"),
      limit: z.number().int().min(1).max(10).optional().default(3).describe("Maximum number of profiles to return"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      profiles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        title: z.string(),
        company: z.string(),
        profileUrl: z.string().url(),
        snippet: z.string().optional(),
        connections: z.number().optional(),
      })).optional(),
      totalResults: z.number().optional(),
      error: z.string().optional(),
    }),
        execute: async ({ query, limit = 3 }) => {
          try {
            // Use search_engine with LinkedIn-specific query
            const linkedinQuery = `site:linkedin.com/in ${query}`;
            const searchContent = await searchEngine(linkedinQuery, 'google');
            
            // Process search results to extract LinkedIn profile data
            const profiles = extractLinkedInProfiles(searchContent, limit);
            
            return { 
              success: true, 
              profiles: profiles, 
              totalResults: profiles.length 
            };
          } catch (error) {
            return { success: false, error: `LinkedIn profile search failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        },
  }),

  searchSerp: createTool({
    id: 'search_serp',
    description: "Perform a search engine query using BrightData MCP HTTP bridge to find relevant web pages",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g., 'Arsenal FC official website')"),
      engine: z.string().optional().default("google").describe("Search engine to use (e.g., 'google', 'bing')"),
      limit: z.number().int().min(1).max(10).optional().default(5).describe("Maximum number of search results to return"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      results: z.array(z.object({
        title: z.string(),
        url: z.string().url(),
        snippet: z.string().optional(),
      })).optional(),
      totalResults: z.number().optional(),
      error: z.string().optional(),
    }),
        execute: async ({ query, engine = "google", limit = 5 }) => {
          try {
            const searchContent = await searchEngine(query, engine);
            
            // Process search results to extract structured data
            const results = extractSearchResults(searchContent, limit);
            
            return { 
              success: true, 
              results: results, 
              totalResults: results.length 
            };
          } catch (error) {
            return { success: false, error: `SERP search failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        },
  }),

};
