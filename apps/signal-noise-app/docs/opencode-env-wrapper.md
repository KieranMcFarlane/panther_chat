# OpenCode Env Wrapper

Use the repo wrapper when running OpenCode from `apps/signal-noise-app`.

## Supported command

```bash
npm run opencode:env -- run --format json --title "smoke test" --dir /Users/kieranmcfarlane/Downloads/panther_chat "reply with exactly: ok"
```

This command loads:

1. `apps/signal-noise-app/.env`
2. `apps/signal-noise-app/backend/.env`

before invoking the real `opencode` binary.

## Why use the wrapper

Plain `opencode` in a fresh shell does not load repo `.env` files by itself. That can cause `401 Unauthorized` failures when `ZAI_API_KEY` is not already exported in the shell environment.

`npm run opencode:env -- run ...` is the supported repo-safe entrypoint.

## Override

Set `OPENCODE_ENV_FILE` to load a specific env file before the standard repo env files:

```bash
OPENCODE_ENV_FILE=/path/to/custom.env npm run opencode:env -- run "reply with exactly: ok"
```
