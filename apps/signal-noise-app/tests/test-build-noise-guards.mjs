import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('graph page short-circuits to fallback data during build', () => {
  const source = fs.readFileSync(
    new URL('../src/app/graph/page.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /function isBuildPhase\(\)/);
  assert.match(source, /return createFallbackGraphData\(\);/);
});

test('automation results route suppresses malformed file spam during build', () => {
  const source = fs.readFileSync(
    new URL('../src/app/api/automation-results/latest/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /const isBuildPhase =/);
  assert.match(source, /let malformedFileCount = 0;/);
  assert.match(source, /if \(!isBuildPhase\) \{/);
});

test('direct MCP client skips auto-connect during build', () => {
  const source = fs.readFileSync(
    new URL('../src/lib/direct-mcp-client.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /function isBuildPhase\(\)/);
  assert.match(source, /if \(!isBuildPhase\(\)\) \{\s*directMCPClient\.connect\(\)\.catch\(console\.error\);/s);
});

test('gitignore denylist covers generated artifacts and local runtime noise', () => {
  const rootIgnore = fs.readFileSync(
    new URL('../../../.gitignore', import.meta.url),
    'utf8'
  );
  const appIgnore = fs.readFileSync(
    new URL('../.gitignore', import.meta.url),
    'utf8'
  );
  const combined = `${rootIgnore}\n${appIgnore}`;

  assert.match(combined, /^\.next\.preclean\*$/m);
  assert.match(combined, /^\.pytest_cache\/$/m);
  assert.match(combined, /^\.venv\*$/m);
  assert.match(combined, /^backend\/data\/dossiers\/\*$/m);
});
