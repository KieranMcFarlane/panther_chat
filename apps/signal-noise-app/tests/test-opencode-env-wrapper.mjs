import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER_PATH = path.resolve(TEST_DIR, '..', 'scripts', 'opencode-with-env.mjs');

test('loads ZAI_API_KEY from the configured env file before invoking opencode', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'opencode-wrapper-'));
  const envPath = path.join(sandbox, 'custom.env');
  const binDir = path.join(sandbox, 'bin');
  const fakeOpencode = path.join(binDir, 'opencode');
  const payload = path.join(sandbox, 'payload.json');

  writeFileSync(envPath, 'ZAI_API_KEY=wrapped-test-key\n');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    fakeOpencode,
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(payload)}, JSON.stringify({
  key: process.env.ZAI_API_KEY || '',
  args: process.argv.slice(2),
}));
`,
  );
  chmodSync(fakeOpencode, 0o755);

  const result = spawnSync(process.execPath, [WRAPPER_PATH, 'run', '--format', 'json', 'hello'], {
    env: {
      ...process.env,
      OPENCODE_ENV_FILE: envPath,
      OPENCODE_BIN: fakeOpencode,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(readFileSync(payload, 'utf8'));
  assert.equal(parsed.key, 'wrapped-test-key');
  assert.deepEqual(parsed.args, ['run', '--format', 'json', 'hello']);
});
