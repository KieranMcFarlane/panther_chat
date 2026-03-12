import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guardedRoutes = [
  '../src/app/api/activities/route.ts',
  '../src/app/api/analyze-sales-pipeline/route.ts',
  '../src/app/api/ai-agent/config/route.ts',
  '../src/app/api/ai-agent/process/route.ts',
  '../src/app/api/ai-agent/test/route.ts',
  '../src/app/api/agent/stream/route.ts',
  '../src/app/api/auth/[...all]/route.ts',
  '../src/app/api/autonomous-rfp/start/route.ts',
  '../src/app/api/autonomous-rfp/status/route.ts',
];

for (const routePath of guardedRoutes) {
  test(`${routePath} is forced dynamic for build safety`, () => {
    const source = fs.readFileSync(new URL(routePath, import.meta.url), 'utf8');

    assert.match(source, /export const dynamic = ['"]force-dynamic['"]/);
  });
}
