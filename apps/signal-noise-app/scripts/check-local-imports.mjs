#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
const ignoreConfigPath = path.join(projectRoot, 'config', 'import-preflight-ignore.json');
const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoreDirs = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (sourceExts.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function parseImports(content) {
  const specs = [];
  const re = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const spec = (match[1] || match[2] || '').trim();
    if (spec) specs.push(spec);
  }
  return specs;
}

function moduleExists(basePath) {
  const direct = fs.existsSync(basePath) && fs.statSync(basePath).isFile();
  if (direct) return true;

  for (const ext of exts) {
    if (fs.existsSync(basePath + ext)) return true;
  }
  for (const ext of exts) {
    if (fs.existsSync(path.join(basePath, `index${ext}`))) return true;
  }
  return false;
}

function resolveImport(fromFile, spec) {
  if (spec.startsWith('@/')) {
    return path.join(srcRoot, spec.slice(2));
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  return null;
}

const files = walk(srcRoot);
const missing = [];
let ignoredPairs = new Set();

try {
  const raw = fs.readFileSync(ignoreConfigPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    ignoredPairs = new Set(parsed.filter((v) => typeof v === 'string'));
  }
} catch {
  // Optional config
}

for (const file of files) {
  let content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const imports = parseImports(content);
  for (const spec of imports) {
    const resolved = resolveImport(file, spec);
    if (!resolved) continue;
    if (!moduleExists(resolved)) {
      const fileRel = path.relative(projectRoot, file);
      const key = `${fileRel}::${spec}`;
      if (ignoredPairs.has(key)) {
        continue;
      }
      missing.push({
        file: fileRel,
        import: spec,
      });
    }
  }
}

if (missing.length > 0) {
  console.error(`Found ${missing.length} unresolved local imports:\n`);
  for (const item of missing) {
    console.error(`- ${item.file}: "${item.import}"`);
  }
  process.exit(1);
}

console.log(`Import preflight passed (${files.length} files scanned).`);
