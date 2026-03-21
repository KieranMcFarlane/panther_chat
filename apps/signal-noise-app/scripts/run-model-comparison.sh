#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT_SECONDS="${1:-2700}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="backend/data/dossiers/run_reports"
MODEL_DIR="$REPORT_DIR/model_compare_${STAMP}"
mkdir -p "$MODEL_DIR"

PRIMARY_MODEL="${CHUTES_MODEL_PRIMARY:-moonshotai/Kimi-K2.5-TEE}"
SECONDARY_MODEL="${CHUTES_MODEL_SECONDARY:-MiniMaxAI/MiniMax-M2.5-TEE}"
TERTIARY_MODEL="${CHUTES_MODEL_TERTIARY:-zai-org/GLM-5-TEE}"

labels=(primary secondary tertiary)
models=("$PRIMARY_MODEL" "$SECONDARY_MODEL" "$TERTIARY_MODEL")

declare -a pids=()
declare -a summaries=()
declare -a logs=()

echo "==> Model comparison (parallel)"
echo "    timeout=${TIMEOUT_SECONDS}s"

echo "    primary=$PRIMARY_MODEL"
echo "    secondary=$SECONDARY_MODEL"
echo "    tertiary=$TERTIARY_MODEL"

for idx in "${!labels[@]}"; do
  label="${labels[$idx]}"
  model="${models[$idx]}"
  summary="$MODEL_DIR/regression_${label}.json"
  log="$MODEL_DIR/${label}.log"
  summaries+=("$summary")
  logs+=("$log")

  (
    CHUTES_MODEL_PRIMARY="$model" \
    CHUTES_MODEL_SECONDARY="$model" \
    CHUTES_MODEL_TERTIARY="$model" \
    PIPELINE_LEAN_VERIFY="${PIPELINE_LEAN_VERIFY:-true}" \
    BATCH_SUMMARY_PATH="$summary" \
    bash scripts/run-pipeline-regression-batch.sh "$TIMEOUT_SECONDS"
  ) >"$log" 2>&1 &
  pids+=("$!")
  echo "    started ${label} pid=${pids[-1]} summary=${summary}"
done

exit_code=0
for idx in "${!pids[@]}"; do
  if ! wait "${pids[$idx]}"; then
    echo "    run failed: ${labels[$idx]} (see ${logs[$idx]})"
    exit_code=1
  fi
done

COMPARISON_JSON="$MODEL_DIR/model_comparison_${STAMP}.json"
python3 - <<'PY' "$COMPARISON_JSON" "${labels[@]}" "${models[@]}" "${summaries[@]}"
import json
import statistics
import sys
from pathlib import Path

comparison_path = Path(sys.argv[1])
args = sys.argv[2:]
chunk = len(args) // 3
labels = args[:chunk]
models = args[chunk:chunk*2]
summaries = args[chunk*2:]

rows = []
for label, model, summary_path in zip(labels, models, summaries):
    summary_file = Path(summary_path)
    entities = []
    if summary_file.exists():
        data = json.loads(summary_file.read_text())
        entities = data if isinstance(data, list) else data.get("entities", [])

    pass_count = sum(1 for e in entities if e.get("acceptance_gate_passed"))
    conf_vals = [float(e.get("final_confidence")) for e in entities if e.get("final_confidence") is not None]
    signal_vals = [int(e.get("signals_discovered") or 0) for e in entities]
    llm_empty = sum(int(e.get("llm_empty_response") or 0) for e in entities)
    schema_fallback = sum(int(e.get("schema_gate_fallback") or 0) for e in entities)
    low_signal = sum(int(e.get("low_signal_content") or 0) for e in entities)
    synthetic = sum(int(e.get("synthetic_url_attempt_count") or 0) for e in entities)
    dual_ok_passed = all(bool(e.get("dual_write_ok")) for e in entities if e.get("acceptance_gate_passed"))

    avg_conf = round(statistics.mean(conf_vals), 4) if conf_vals else 0.0
    avg_signals = round(statistics.mean(signal_vals), 3) if signal_vals else 0.0

    score = (pass_count * 100.0) + (avg_conf * 10.0) + (avg_signals * 5.0)
    score -= (llm_empty * 2.0 + schema_fallback * 1.0 + low_signal * 1.0 + synthetic * 5.0)

    rows.append(
        {
            "label": label,
            "model": model,
            "summary_path": str(summary_file),
            "entity_count": len(entities),
            "pass_count": pass_count,
            "avg_final_confidence": avg_conf,
            "avg_signals_discovered": avg_signals,
            "llm_empty_response_count": llm_empty,
            "schema_gate_fallback_count": schema_fallback,
            "low_signal_content_count": low_signal,
            "synthetic_url_attempt_count": synthetic,
            "dual_write_ok_for_passed": dual_ok_passed,
            "score": round(score, 4),
        }
    )

rows.sort(key=lambda x: x["score"], reverse=True)
result = {
    "winner": rows[0] if rows else None,
    "ranked": rows,
}
comparison_path.write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
PY

echo "Model comparison summary: $COMPARISON_JSON"
exit "$exit_code"
