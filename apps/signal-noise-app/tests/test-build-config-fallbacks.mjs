import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const authSource = fs.readFileSync(
  new URL('../src/lib/auth.ts', import.meta.url),
  'utf8'
);
const rfpAgentSource = fs.readFileSync(
  new URL('../src/lib/claude-agent-rfp-intelligence.ts', import.meta.url),
  'utf8'
);
const historicalProcessorSource = fs.readFileSync(
  new URL('../src/lib/enhanced-historical-batch-processor.ts', import.meta.url),
  'utf8'
);
const automationResultsSource = fs.readFileSync(
  new URL('../src/app/api/automation-results/latest/route.ts', import.meta.url),
  'utf8'
);

test('auth uses a deterministic non-default secret during local builds', () => {
  assert.match(authSource, /local-build-secret-panther-chat-2026/);
  assert.match(authSource, /secret: buildSafeSecret/);
});

test('rfp intelligence agent loads MCP config lazily from .mcp.json instead of fetching the API route', () => {
  assert.match(rfpAgentSource, /fs from 'fs\/promises'/);
  assert.match(rfpAgentSource, /path from 'path'/);
  assert.match(rfpAgentSource, /ensureMCPConfigLoaded/);
  assert.doesNotMatch(rfpAgentSource, /fetch\(`\$\{baseUrl\}\/api\/mcp-config`\)/);
});

test('enhanced historical batch processor loads MCP config lazily from .mcp.json', () => {
  assert.match(historicalProcessorSource, /ensureMCPConfigLoaded/);
  assert.doesNotMatch(historicalProcessorSource, /fetch\(`\$\{baseUrl\}\/api\/mcp-config`\)/);
});

test('automation results route skips malformed files with a concise warning', () => {
  assert.match(automationResultsSource, /Skipping malformed automation results file/);
});
