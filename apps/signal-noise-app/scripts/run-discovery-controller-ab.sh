#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT_SECONDS="${1:-2700}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="backend/data/dossiers/run_reports"
MODEL_DIR="$REPORT_DIR/discovery_controller_ab_${STAMP}"
mkdir -p "$MODEL_DIR"

PLANNER_A_MODEL="${CHUTES_MODEL_PLANNER_A:-moonshotai/Kimi-K2.5-TEE}"
PLANNER_B_MODEL="${CHUTES_MODEL_PLANNER_B:-Qwen/Qwen3-235B-A22B-Instruct-2507-TEE}"
JUDGE_MODEL="${CHUTES_MODEL_JUDGE:-deepseek-ai/DeepSeek-V3.2-TEE}"
FALLBACK_MODEL="${CHUTES_MODEL_FALLBACK:-zai-org/GLM-5-TEE}"

labels=(planner_a planner_b)
models=("$PLANNER_A_MODEL" "$PLANNER_B_MODEL")

declare -a summaries=()

echo "==> Discovery controller A/B"
echo "    timeout=${TIMEOUT_SECONDS}s"
echo "    planner_a=$PLANNER_A_MODEL"
echo "    planner_b=$PLANNER_B_MODEL"
echo "    judge=$JUDGE_MODEL"
echo "    fallback=$FALLBACK_MODEL"

for idx in "${!labels[@]}"; do
  label="${labels[$idx]}"
  model="${models[$idx]}"
  summary="$MODEL_DIR/${label}_batch_summary.json"
  log="$MODEL_DIR/${label}.log"
  summaries+=("$summary")

  echo "    running ${label} planner=${model}"
  (
    CHUTES_MODEL_PLANNER="$model" \
    CHUTES_MODEL_JUDGE="${CHUTES_MODEL_JUDGE:-$JUDGE_MODEL}" \
    CHUTES_MODEL_FALLBACK="${CHUTES_MODEL_FALLBACK:-$FALLBACK_MODEL}" \
    PIPELINE_LEAN_VERIFY="${PIPELINE_LEAN_VERIFY:-true}" \
    BATCH_SUMMARY_PATH="$summary" \
    bash scripts/run-pipeline-regression-batch.sh "$TIMEOUT_SECONDS"
  ) >"$log" 2>&1
done

COMPARISON_JSON="$MODEL_DIR/model_ab_summary_${STAMP}.json"
python3 - <<'PY' "$COMPARISON_JSON" "${labels[@]}" "${models[@]}" "${summaries[@]}"
import json
import statistics
import sys
from pathlib import Path

comparison_path = Path(sys.argv[1])
args = sys.argv[2:]
chunk = len(args) // 3
labels = args[:chunk]
models = args[chunk:chunk * 2]
summaries = args[chunk * 2:]

rows = []
for label, model, summary_path in zip(labels, models, summaries):
    summary_file = Path(summary_path)
    entities = []
    if summary_file.exists():
        data = json.loads(summary_file.read_text())
        entities = data if isinstance(data, list) else data.get("entities", [])

    pass_count = sum(1 for entity in entities if entity.get("acceptance_gate_passed"))
    conf_vals = [float(entity.get("final_confidence")) for entity in entities if entity.get("final_confidence") is not None]
    signal_vals = [int(entity.get("signals_discovered") or 0) for entity in entities]
    avg_conf = round(statistics.mean(conf_vals), 4) if conf_vals else 0.0
    avg_signals = round(statistics.mean(signal_vals), 3) if signal_vals else 0.0

    rows.append(
        {
            "label": label,
            "planner_model": model,
            "summary_path": str(summary_file),
            "entity_count": len(entities),
            "pass_count": pass_count,
            "avg_final_confidence": avg_conf,
            "avg_signals_discovered": avg_signals,
            "score": round((pass_count * 100.0) + (avg_conf * 10.0) + (avg_signals * 5.0), 4),
        }
    )

rows.sort(key=lambda row: row["score"], reverse=True)
result = {
    "winner": rows[0] if rows else None,
    "ranked": rows,
}
comparison_path.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
PY

echo "Discovery controller A/B summary: $COMPARISON_JSON"
