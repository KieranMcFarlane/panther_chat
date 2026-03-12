import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guardedRoutes = [
  '../src/app/api/mcp-debug/route.ts',
  '../src/app/api/rfp-vision-analysis/route.ts',
];

for (const routePath of guardedRoutes) {
  test(`${routePath} is forced dynamic to avoid build-time MCP startup`, () => {
    const source = fs.readFileSync(new URL(routePath, import.meta.url), 'utf8');
    assert.match(source, /export const dynamic = 'force-dynamic'/);
  });
}
