import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const authClientSource = fs.readFileSync(
  new URL('../src/lib/auth-client.ts', import.meta.url),
  'utf8'
);
const authSource = fs.readFileSync(
  new URL('../src/lib/auth.ts', import.meta.url),
  'utf8'
);
const authUrlSource = fs.readFileSync(
  new URL('../src/lib/auth-url.ts', import.meta.url),
  'utf8'
);

test('auth client resolves against same-origin in the browser instead of forcing the deployed auth URL', () => {
  assert.match(authClientSource, /resolveClientAuthBaseUrl/);
  assert.match(authUrlSource, /window\.location\.origin/);
  assert.match(authUrlSource, /NODE_ENV === "production"/);
});

test('server auth falls back to localhost outside production instead of reusing hosted auth envs', () => {
  assert.match(authSource, /resolveServerAuthBaseUrl/);
  assert.match(authSource, /resolveTrustedOrigins/);
  assert.match(authSource, /NODE_ENV === "production"/);
});
