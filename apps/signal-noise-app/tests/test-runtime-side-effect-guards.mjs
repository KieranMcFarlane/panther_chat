import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mcpBusSource = fs.readFileSync(
  new URL('../src/lib/mcp/MCPClientBus.ts', import.meta.url),
  'utf8'
);
const activityLoggerSource = fs.readFileSync(
  new URL('../src/lib/activity-logger.ts', import.meta.url),
  'utf8'
);
const graphStoreSource = fs.readFileSync(
  new URL('../src/lib/graph-store.ts', import.meta.url),
  'utf8'
);
const glmSource = fs.readFileSync(
  new URL('../src/lib/claude-glm4v-integration.ts', import.meta.url),
  'utf8'
);
const headlessVerifierSource = fs.readFileSync(
  new URL('../src/lib/real-headless-verifier.ts', import.meta.url),
  'utf8'
);
const entityScalingSource = fs.readFileSync(
  new URL('../src/lib/entity-scaling-manager.ts', import.meta.url),
  'utf8'
);
const entityScalingRouteSource = fs.readFileSync(
  new URL('../src/app/api/entity-scaling/route.ts', import.meta.url),
  'utf8'
);
const authSource = fs.readFileSync(
  new URL('../src/lib/auth.ts', import.meta.url),
  'utf8'
);

test('MCP client bus does not auto-initialize on module import', () => {
  assert.doesNotMatch(mcpBusSource, /mcpBus\.initialize\(\)\.catch\(console\.error\)/);
});

test('activity logger guards localStorage during SSR', () => {
  assert.match(activityLoggerSource, /if \(typeof localStorage === 'undefined'\) \{/);
  assert.match(activityLoggerSource, /ensureStorageLoaded\(\)/);
});

test('graph store service lazily creates the driver and suppresses build-phase connection logs', () => {
  assert.match(graphStoreSource, /private driver: any \| null = null/);
  assert.match(graphStoreSource, /private ensureDriver\(\)/);
  assert.match(graphStoreSource, /function isBuildPhase\(\): boolean/);
});

test('claude glm integration initializes MCP lazily', () => {
  assert.doesNotMatch(glmSource, /constructor\(\)\s*\{\s*this\.initializeMCP\(\);/s);
  assert.match(glmSource, /private initializationPromise: Promise<void> \| null = null/);
  assert.match(glmSource, /await this\.ensureInitialized\(\);/);
});

test('real headless verifier does not auto-initialize on import', () => {
  assert.doesNotMatch(headlessVerifierSource, /realHeadlessVerifier\.initialize\(\)\.catch\(console\.error\)/);
  assert.match(headlessVerifierSource, /private initialized = false/);
});

test('entity scaling manager no longer auto-initializes in the constructor', () => {
  assert.doesNotMatch(entityScalingSource, /this\.initialize\(\);/);
  assert.match(entityScalingSource, /async initialize\(\)/);
  assert.match(entityScalingRouteSource, /await entityScalingManager\.initialize\(\);/);
});

test('auth fallback uses memory adapter instead of a raw Map', () => {
  assert.match(authSource, /memoryAdapter/);
  assert.doesNotMatch(authSource, /return new Map\(\)/);
});
