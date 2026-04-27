#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(MODULE_DIR, '..');
const WORKTREE_ROOT = path.resolve(APP_ROOT, '..', '..');

const envFiles = [
  process.env.OPENCODE_ENV_FILE,
  path.join(APP_ROOT, '.env'),
  path.join(APP_ROOT, 'backend', '.env'),
  path.join(WORKTREE_ROOT, '.env'),
].filter(Boolean);

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

const opencodeBin = process.env.OPENCODE_BIN || 'opencode';
const args = process.argv.slice(2);
const result = spawnSync(opencodeBin, args, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(result.status || 1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(1);
