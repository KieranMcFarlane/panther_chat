import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routePath = new URL('../src/app/api/ralph/analytics/evidence-impact/route.ts', import.meta.url);
const routeSource = fs.readFileSync(routePath, 'utf8');

test('evidence-impact route is forced dynamic for build safety', () => {
  assert.match(routeSource, /export const dynamic = 'force-dynamic'/);
});

test('evidence-impact route handles missing impact data without dereferencing source', () => {
  assert.match(routeSource, /best_source: bestSource\s*\?/);
  assert.match(routeSource, /: "N\/A"/);
  assert.match(routeSource, /totalTypeImpact > 0/);
});
