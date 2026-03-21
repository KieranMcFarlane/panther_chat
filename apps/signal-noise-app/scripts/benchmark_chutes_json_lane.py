#!/usr/bin/env python3
"""Micro-benchmark strict JSON lane reliability for discovery eval contract."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import httpx

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"

import sys

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env", override=False)
except Exception:
    pass

PROMPT = (
    'Output one JSON object like {"d":"N","r":"ep","c":"N"}. No prose.\n'
    "L=press_release;S=official digital partnership announced and procurement timeline published.\n"
)


def _parse_payload(result: Dict[str, Any]) -> Dict[str, Any]:
    structured = result.get("structured_output")
    if isinstance(structured, dict):
        return structured
    raw = str(result.get("content") or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


async def run_benchmark(calls: int, max_tokens: int) -> Dict[str, Any]:
    api_key = os.getenv("CHUTES_API_KEY", "").strip()
    base_url = os.getenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1").rstrip("/")
    model = os.getenv("CHUTES_MODEL_JSON", "deepseek-ai/DeepSeek-V3-0324-TEE").strip()
    timeout_seconds = float(os.getenv("STRICT_JSON_BENCH_TIMEOUT_SECONDS", "15"))
    if not api_key:
        raise RuntimeError("CHUTES_API_KEY is required for benchmark")

    endpoint = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    latencies = []
    length_stop_count = 0
    schema_valid_count = 0
    empty_content_count = 0
    model_counter: Counter[str] = Counter()
    runs = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds)) as client:
        for idx in range(calls):
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "Output JSON object only."},
                    {"role": "user", "content": PROMPT},
                ],
                "temperature": 0.0,
                "max_tokens": max_tokens,
                "stream": False,
                "response_format": {"type": "json_object"},
                "include_reasoning": False,
            }
            started = time.perf_counter()
            result: Dict[str, Any] = {
                "content": "",
                "structured_output": None,
                "stop_reason": "none",
                "model_used": model,
            }
            try:
                response = await client.post(endpoint, headers=headers, json=payload)
                elapsed_ms = round((time.perf_counter() - started) * 1000.0, 2)
                latencies.append(elapsed_ms)
                if response.status_code == 200:
                    body = response.json()
                    choice = ((body.get("choices") or [{}])[0]) if isinstance(body, dict) else {}
                    message = choice.get("message") or {}
                    result["content"] = str(message.get("content") or "")
                    result["structured_output"] = message.get("parsed")
                    result["stop_reason"] = str(choice.get("finish_reason") or "none")
                    result["model_used"] = str(body.get("model") or model)
                else:
                    result["stop_reason"] = f"http_{response.status_code}"
            except Exception:
                elapsed_ms = round((time.perf_counter() - started) * 1000.0, 2)
                latencies.append(elapsed_ms)
                result["stop_reason"] = "request_error"

            stop_reason = str(result.get("stop_reason") or "").strip().lower()
            if stop_reason == "length":
                length_stop_count += 1

            model_used = str(result.get("model_used") or model)
            model_counter[model_used] += 1

            payload_obj = _parse_payload(result)
            schema_valid = (
                isinstance(payload_obj, dict)
                and str(payload_obj.get("d") or payload_obj.get("decision") or "").strip().upper() != ""
                and str(payload_obj.get("r") or payload_obj.get("reason_code") or "").strip().lower() != ""
                and str(payload_obj.get("c") or payload_obj.get("confidence_delta_bucket") or "").strip().upper() != ""
            )
            if schema_valid:
                schema_valid_count += 1

            content = str(result.get("content") or "").strip()
            if not content and not isinstance(result.get("structured_output"), dict):
                empty_content_count += 1

            runs.append(
                {
                    "i": idx + 1,
                    "model_used": model_used,
                    "latency_ms": elapsed_ms,
                    "stop_reason": stop_reason or "none",
                    "schema_valid": schema_valid,
                    "content_len": len(content),
                }
            )

    latencies_sorted = sorted(latencies)
    p95_idx = max(0, min(len(latencies_sorted) - 1, int(round(0.95 * (len(latencies_sorted) - 1)))))
    p95_latency_ms = round(latencies_sorted[p95_idx], 2) if latencies_sorted else 0.0
    baseline_p95_ms = float(os.getenv("STRICT_JSON_BASELINE_P95_MS", "12000"))

    length_stop_rate = round(length_stop_count / calls, 4) if calls else 0.0
    schema_valid_rate = round(schema_valid_count / calls, 4) if calls else 0.0

    return {
        "calls": calls,
        "max_tokens": max_tokens,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_distribution": dict(model_counter),
        "length_stop_count": length_stop_count,
        "length_stop_rate": length_stop_rate,
        "schema_valid_count": schema_valid_count,
        "schema_valid_rate": schema_valid_rate,
        "empty_content_count": empty_content_count,
        "p95_latency_ms": p95_latency_ms,
        "baseline_p95_ms": baseline_p95_ms,
        "pass_criteria": {
            "length_stop_rate_le_5pct": length_stop_rate <= 0.05,
            "schema_valid_rate_ge_95pct": schema_valid_rate >= 0.95,
            "p95_below_baseline": p95_latency_ms <= baseline_p95_ms,
        },
        "runs": runs,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark strict JSON lane on Chutes")
    parser.add_argument("--calls", type=int, default=30)
    parser.add_argument("--max-tokens", type=int, default=128)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    report = asyncio.run(run_benchmark(calls=max(1, args.calls), max_tokens=max(32, args.max_tokens)))

    output_path = args.output
    if output_path is None:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_path = ROOT / "backend" / "data" / "dossiers" / "run_reports" / f"strict_json_benchmark_{ts}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps({"output": str(output_path), **{k: report[k] for k in (
        "calls",
        "length_stop_rate",
        "schema_valid_rate",
        "p95_latency_ms",
        "pass_criteria",
    )}}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
