// Simple helper for native BrightData MCP calls
const BRIGHTDATA_MCP_URL = process.env.BRIGHTDATA_MCP_URL || "http://localhost:8014";

export async function callBrightDataTool(toolName: string, args: Record<string, any>): Promise<any> {
  const response = await fetch(`${BRIGHTDATA_MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    throw new Error(`BrightData MCP error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'BrightData MCP call failed');
  }

  // Return the content text directly for BrightData tools
  return result.result?.content?.[0]?.text || result.result;
}

export async function scrapeAsMarkdown(url: string): Promise<string> {
  return await callBrightDataTool('scrape_as_markdown', { url });
}

export async function searchEngine(query: string, engine: string = 'google'): Promise<string> {
  return await callBrightDataTool('search_engine', { query, engine });
}

// Helper functions to extract data from search results
export function extractLinkedInProfiles(searchContent: string, limit: number): any[] {
  const profiles: any[] = [];
  
  // Simple regex patterns to extract LinkedIn profile information from search results
  const profilePattern = /linkedin\.com\/in\/([^\s"]+)/gi;
  const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
  
  const matches = searchContent.match(profilePattern) || [];
  const names = searchContent.match(namePattern) || [];
  
  for (let i = 0; i < Math.min(matches.length, limit); i++) {
    const profileUrl = matches[i].startsWith('http') ? matches[i] : `https://${matches[i]}`;
    const name = names[i] || 'Unknown';
    
    profiles.push({
      id: `linkedin_${i}`,
      name: name,
      title: 'Position extracted from search',
      company: 'Company extracted from search',
      profileUrl: profileUrl,
      snippet: 'LinkedIn profile found via search',
      connections: null
    });
  }
  
  return profiles;
}

export function extractSearchResults(searchContent: string, limit: number): any[] {
  const results: any[] = [];
  
  // Extract URLs and titles from search content
  const urlPattern = /https?:\/\/[^\s"<>]+/gi;
  const titlePattern = /^### (.+)$/gm;
  
  const urls = searchContent.match(urlPattern) || [];
  const titles = searchContent.match(titlePattern) || [];
  
  for (let i = 0; i < Math.min(urls.length, limit); i++) {
    const title = titles[i] ? titles[i].replace('### ', '') : 'Search Result';
    const snippet = `Search result ${i + 1} from ${urls[i]}`;
    
    results.push({
      title: title,
      url: urls[i],
      snippet: snippet
    });
  }
  
  return results;
}
