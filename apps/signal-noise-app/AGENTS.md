# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Next.js app (App Router). Routes/pages live in `src/app`, API routes in `src/app/api`.
- `src/components`, `src/lib`, `src/services`, `src/styles`, `src/types`: UI, shared utilities, service logic, styling, and types.
- `backend/`: Python services, data pipelines, and graph integrations. Entry scripts are present in this folder (for example `main.py`, `run_server.py`).
- `tests/`: JavaScript/MJS integration tests and runners.
- `scripts/`: operational scripts for setup, sync, and data tasks.
- `mcp-servers/`, `livekit-agents/`, `cli/`: auxiliary packages and tooling.

## Build, Test, and Development Commands
- `npm run dev`: start Next.js dev server on port `3005`.
- `npm run build`: production build.
- `npm run start`: start production server on port `4328`.
- `npm run lint`: run Next.js ESLint checks.
- `npm test`: run the repo test runner (`tests/run-tests.sh`).
- `npm run test:coverage`: run tests plus coverage report generation.
- `npm run test:watch`: watch `src/` and `tests/` and re-run tests.

## Coding Style & Naming Conventions
- Follow existing file patterns; prefer minimal diffs and consistent formatting within each file.
- React components: `PascalCase` file names; hooks use `useSomething` naming.
- Route directories under `src/app` use kebab-case (e.g., `rfp-intelligence`).
- Favor colocating related UI pieces under `src/components` and logic under `src/lib` or `src/services`.
- Linting: use `npm run lint` before pushing.

## Testing Guidelines
- Primary JS test flow is `npm test` (integration-focused).
- Targeted test scripts exist in `tests/` and root scripts; run the specific file when iterating.
- Python tests and checks live under `backend/` (`test_*.py` files). Use the existing scripts in that folder to validate backend changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commit-style prefixes seen in history: `feat:`, `fix:`, `docs:`, `chore:`, `security:`.
- PRs should include: concise summary, testing notes (what you ran), and screenshots for UI changes.
- Do not commit secrets. Use `.env.example` and the provided `.env.*` templates.

## Configuration Notes
- Environment templates live at repo root (`.env.example`, `.env.production`, `.env.test`). Copy and fill as needed.
- Keep local credentials in `.env` or `.env.local` only.
