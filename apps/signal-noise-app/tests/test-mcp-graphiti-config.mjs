import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const baseDir = path.join(process.cwd(), 'apps/signal-noise-app');

function readJson(relativePath) {
  const filePath = path.join(baseDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('shared MCP configs expose Graphiti and not Neo4j in the active config', () => {
  const mcpConfig = readJson('mcp-config.json');
  const dotMcpConfig = readJson('.mcp.json');

  assert.ok(mcpConfig.mcpServers.graphiti, 'mcp-config.json should define graphiti');
  assert.ok(dotMcpConfig.mcpServers.graphiti, '.mcp.json should define graphiti');
  assert.ok(!dotMcpConfig.mcpServers['neo4j-mcp'], '.mcp.json should not expose neo4j-mcp');
});
