// Simple helper for native Neo4j MCP calls
const NEO4J_MCP_URL = process.env.NEO4J_MCP_URL || "http://localhost:3004";

export async function queryNeo4j(query: string, params: Record<string, any> = {}): Promise<any> {
  const response = await fetch(`${NEO4J_MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'execute_query',
        arguments: { query, params }
      }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Neo4j MCP error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Neo4j MCP call failed');
  }

  // Parse JSON from content if available
  if (result.result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.result.content[0].text);
    } catch {
      return result.result.content[0].text;
    }
  }
  
  return result.result;
}

export async function createNeo4jNode(label: string, properties: Record<string, any>): Promise<any> {
  const response = await fetch(`${NEO4J_MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'create_node',
        arguments: { label, properties }
      }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Neo4j MCP error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Neo4j MCP call failed');
  }

  return result.result;
}
