#!/usr/bin/env bash
set -euo pipefail

DOCS_DIR="${1:-new-arch-docs/iteration-08}"
OUT_DIR="${2:-output/ralph-wiggum/iteration-08}"
TASKS_INPUT="${3:-extract_entities extract_actions extract_constraints extract_sequences extract_io_contracts}"

IFS=' ' read -r -a TASKS <<< "$TASKS_INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
GUIDANCE_TEMPLATE="${REPO_ROOT}/docs/ralph-wiggum/templates/ralph-wiggum-guidance.txt"

if [[ ! -f "$GUIDANCE_TEMPLATE" ]]; then
  echo "Missing guidance template: $GUIDANCE_TEMPLATE" >&2
  exit 1
fi

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "Docs dir not found: $DOCS_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

shopt -s nullglob
DOC_FILES=("$DOCS_DIR"/*.md)
if [[ ${#DOC_FILES[@]} -eq 0 ]]; then
  echo "No .md files found in $DOCS_DIR" >&2
  exit 1
fi

for task in "${TASKS[@]}"; do
  case "$task" in
    extract_entities)
      schema=$(cat <<'JSON'
{
  "commands": [],
  "flags": [],
  "files": [],
  "env_vars": [],
  "tools": []
}
JSON
)
      ;;
    extract_actions)
      schema=$(cat <<'JSON'
{
  "actions": [
    { "verb": "run", "object": "claude-code" }
  ]
}
JSON
)
      ;;
    extract_constraints)
      schema=$(cat <<'JSON'
{
  "constraints": [
    "Claude Code must run in repo root"
  ]
}
JSON
)
      ;;
    extract_sequences)
      schema=$(cat <<'JSON'
{
  "sequences": [
    ["install", "configure", "run"]
  ]
}
JSON
)
      ;;
    extract_io_contracts)
      schema=$(cat <<'JSON'
{
  "io": [
    {
      "command": "claude code",
      "input": ["repo"],
      "output": ["diff", "stdout"]
    }
  ]
}
JSON
)
      ;;
    *)
      echo "Unknown task: $task" >&2
      exit 1
      ;;
  esac

  task_out_dir="${OUT_DIR}/${task}"
  mkdir -p "$task_out_dir"

  for file in "${DOC_FILES[@]}"; do
    base="$(basename "$file" .md)"
    out_file="${task_out_dir}/${base}.json"

    prompt="$(cat "$GUIDANCE_TEMPLATE")

Task: ralph_wiggum_${task}

Output schema:
${schema}

Input:
<<<
$(cat "$file")
>>>"

    printf "Processing %s with %s\n" "$file" "$task"
    codex exec "$prompt" > "$out_file"
  done
done

