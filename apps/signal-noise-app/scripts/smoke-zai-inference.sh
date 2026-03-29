#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_ROOT="$(cd "$APP_ROOT/../.." && pwd)"
REPO_ROOT="$(cd "$WORKTREE_ROOT/../.." && pwd)"

ENV_FILE=""
for candidate in \
  "$APP_ROOT/.env" \
  "$REPO_ROOT/apps/signal-noise-app/.env" \
  "$WORKTREE_ROOT/.env"
do
  if [[ -f "$candidate" ]]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [[ -z "$ENV_FILE" ]]; then
  echo "missing env file; checked: $APP_ROOT/.env, $REPO_ROOT/apps/signal-noise-app/.env, $WORKTREE_ROOT/.env" >&2
  exit 1
fi

ENV_FILE="$ENV_FILE" node <<'NODE'
const fs = require('fs');
const envFile = process.env.ENV_FILE;
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx <= 0) continue;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic';
const apiKey = env.ANTHROPIC_AUTH_TOKEN || env.ZAI_API_KEY || env.ANTHROPIC_API_KEY;
const model = env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-5';

if (!apiKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_api_key', hint: 'set ANTHROPIC_AUTH_TOKEN or ZAI_API_KEY in apps/signal-noise-app/.env' }, null, 2));
  process.exit(1);
}

(async () => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    }),
  });
  const bodyText = await response.text();
  let parsed = bodyText;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // keep raw text
  }
  const result = {
    ok: response.ok,
    status: response.status,
    model,
    base_url: baseUrl,
    body: parsed,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(response.ok ? 0 : 2);
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(3);
});
NODE
