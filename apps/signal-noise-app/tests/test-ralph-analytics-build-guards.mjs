import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = new URL('../src/lib/ralph-analytics-helper.ts', import.meta.url);
const helperSource = fs.readFileSync(helperPath, 'utf8');

test('loadAllRalphStates returns an empty dataset when runtime bindings are missing', () => {
  assert.match(
    helperSource,
    /if\s*\(\(error as NodeJS\.ErrnoException\)\?\.code === 'ENOENT'\)\s*\{\s*console\.warn\('Runtime bindings directory not found, returning empty Ralph analytics dataset'\);\s*return \[\];\s*\}/s
  );
});

test('loadAllRalphStates does not rethrow runtime binding load failures', () => {
  const loadAllRalphStatesSection = helperSource.match(
    /export async function loadAllRalphStates\(\): Promise<RalphState\[]> \{[\s\S]*?\n\}/
  )?.[0];

  assert.ok(loadAllRalphStatesSection, 'Expected to find loadAllRalphStates implementation');
  assert.doesNotMatch(loadAllRalphStatesSection, /\bthrow error\b/);
});
