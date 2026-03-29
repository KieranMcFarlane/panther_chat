import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAtomicProcurementPlan } from '../scripts/claude-agent-procurement-atomic.mjs';

test('buildAtomicProcurementPlan uses the canonical broad procurement query and BrightData MCP', () => {
  const plan = buildAtomicProcurementPlan({
    entityName: 'Major League Cricket',
    question: 'Is there an RFP or tender for Major League Cricket?'
  });

  assert.equal(plan.query, 'Major League Cricket RFP tender procurement');
  assert.equal(plan.searchEngine, 'google');
  assert.ok(plan.systemPrompt.includes('BrightData MCP'));
  assert.ok(plan.systemPrompt.includes('LinkedIn'));
  assert.ok(plan.systemPrompt.includes('DeepSeek'));
});

import { buildAtomicProcurementRuntimeConfig } from '../scripts/claude-agent-procurement-atomic.mjs';

test('buildAtomicProcurementRuntimeConfig uses default permissions and the append system prompt field', () => {
  const config = buildAtomicProcurementRuntimeConfig({
    entityName: 'Major League Cricket',
    question: 'Is there an RFP or tender for Major League Cricket?',
    env: {
      BRIGHTDATA_API_TOKEN: 'test-token'
    }
  });

  assert.equal(config.permissionMode, 'default');
  assert.equal(config.maxTurns, 8);
  assert.equal(config.allowedTools[0], 'mcp__brightdata-mcp__search_engine');
  assert.equal(config.mcpServers['brightdata-mcp'].command, 'node');
  assert.deepEqual(config.mcpServers['brightdata-mcp'].args, ['src/mcp-brightdata-server.js']);
  assert.equal(config.mcpServers['brightdata-mcp'].env.API_TOKEN, 'test-token');
  assert.equal(config.mcpServers['brightdata-mcp'].env.BRIGHTDATA_ZONE, 'linkedin_posts_monitor');
  assert.equal(config.systemPrompt.type, 'preset');
  assert.equal(config.systemPrompt.preset, 'claude_code');
  assert.ok(config.systemPrompt.append.includes('BrightData MCP'));
  assert.equal(config.includePartialMessages, true);
});


test('buildAtomicProcurementRuntimeConfig instructs the agent to search first with BrightData MCP', () => {
  const config = buildAtomicProcurementRuntimeConfig({
    entityName: 'Major League Cricket',
    question: 'Is there an RFP or tender for Major League Cricket?',
    env: {
      BRIGHTDATA_API_TOKEN: 'test-token'
    }
  });

  assert.ok(config.systemPrompt.append.includes('First action'));
  assert.ok(config.systemPrompt.append.includes('mcp__brightdata-mcp__search_engine'));
  assert.ok(config.systemPrompt.append.includes('return JSON only'));
});

test('buildAtomicProcurementRuntimeConfig requires a BrightData API token', () => {
  assert.throws(() => {
    buildAtomicProcurementRuntimeConfig({
      entityName: 'Major League Cricket',
      question: 'Is there an RFP or tender for Major League Cricket?',
      env: {}
    });
  }, /BRIGHTDATA_API_TOKEN is required/);
});
