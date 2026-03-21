#!/usr/bin/env python3
"""Long-form BrightData + Ralph pass-2 verification with full artifact logging."""

import argparse
import asyncio
import hashlib
import json
import os
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(BACKEND))

from backend.brightdata_sdk_client import BrightDataSDKClient  # noqa: E402
from backend.claude_client import ClaudeClient  # noqa: E402
from backend.ralph_loop import RalphLoop, RalphLoopConfig  # noqa: E402
from backend.schemas import Signal, SignalType  # noqa: E402


class _NoopGraphiti:
    async def find_related_signals(self, **kwargs):
        return []

    async def upsert_signal(self, signal):
        return {"status": "noop", "signal_id": getattr(signal, "id", None)}


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def _select_signal_scrapes(scrapes: List[Dict[str, Any]], max_signals: int) -> List[Dict[str, Any]]:
    usable = [s for s in scrapes if s.get("status") == "success" and int(s.get("word_count") or 0) >= 120]
    return usable[:max_signals]


def _build_signal(scrape: Dict[str, Any], entity_id: str, idx: int) -> Signal:
    content = scrape.get("content") or ""
    if not content and scrape.get("content_file"):
        try:
            content = Path(str(scrape["content_file"])).read_text(encoding="utf-8")
        except Exception:
            content = ""
    url = scrape.get("url") or ""
    evidence_payload = []
    for ev_idx in range(3):
        evidence_payload.append(
            {
                "source": f"brightdata_scrape_{ev_idx + 1}",
                "credibility_score": 0.8,
                "date": _iso(),
                "url": url,
                "extracted_text": content[:5000],
            }
        )
    return Signal(
        id=f"{entity_id}-probe-signal-{idx}",
        type=SignalType.TECHNOLOGY_ADOPTED,
        confidence=0.82,
        entity_id=entity_id,
        first_seen=datetime.now(timezone.utc),
        metadata={"evidence": evidence_payload, "source_url": url},
    )


async def run(args: argparse.Namespace) -> int:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = (
        Path(args.output_dir)
        if args.output_dir
        else ROOT / "backend" / "data" / "dossiers" / "run_reports" / f"brightdata_longform_hello_{ts}"
    )
    scrapes_dir = run_dir / "scrapes"
    prompts_dir = run_dir / "prompts"
    scrapes_dir.mkdir(parents=True, exist_ok=True)
    prompts_dir.mkdir(parents=True, exist_ok=True)

    report: Dict[str, Any] = {
        "run_at": _iso(),
        "query": args.query,
        "num_results": args.num_results,
        "max_scrapes": args.max_scrapes,
        "run_pass2": bool(args.run_pass2),
        "brightdata": {"search": {}, "scrapes": []},
        "ralph_pass2": {"status": "not_requested", "prompt_logs": [], "validated_signal_ids": []},
    }

    brightdata = BrightDataSDKClient()
    try:
        search = await brightdata.search_engine(
            query=args.query,
            engine="google",
            num_results=args.num_results,
        )
        search_results = search.get("results") or []
        report["brightdata"]["search"] = {
            "status": search.get("status"),
            "source": (search.get("metadata") or {}).get("source"),
            "result_count": len(search_results),
            "top_results": [
                {"position": r.get("position"), "title": r.get("title"), "url": r.get("url")}
                for r in search_results[: min(8, len(search_results))]
            ],
        }

        for idx, item in enumerate(search_results[: args.max_scrapes], start=1):
            url = item.get("url")
            if not url:
                continue
            scraped = await brightdata.scrape_as_markdown(url)
            metadata = scraped.get("metadata") or {}
            content = scraped.get("content") or ""
            scrape_file = scrapes_dir / f"{idx:02d}.md"
            scrape_file.write_text(content, encoding="utf-8")
            report["brightdata"]["scrapes"].append(
                {
                    "url": url,
                    "status": scraped.get("status"),
                    "source": metadata.get("source"),
                    "extraction_mode": metadata.get("extraction_mode"),
                    "fallback_reason": metadata.get("fallback_reason"),
                    "word_count": metadata.get("word_count"),
                    "content_chars": len(content),
                    "content_sha256": _sha256(content),
                    "content_file": str(scrape_file),
                }
            )

        if not args.run_pass2:
            report["ralph_pass2"]["status"] = "skipped"
        elif not os.getenv("CHUTES_API_KEY"):
            report["ralph_pass2"]["status"] = "skipped_missing_chutes_api_key"
        else:
            os.environ["RALPH_PASS2_MICRO_BATCH_SIZE"] = str(args.pass2_batch_size)
            os.environ["RALPH_PASS2_PARALLELISM"] = str(args.pass2_parallelism)
            os.environ["RALPH_PASS2_EVIDENCE_TEXT_CHARS"] = str(args.pass2_evidence_chars)

            claude = ClaudeClient()
            ralph = RalphLoop(claude, _NoopGraphiti(), RalphLoopConfig(enable_confidence_validation=True))
            selected = _select_signal_scrapes(report["brightdata"]["scrapes"], max_signals=args.max_signals)
            signals = [_build_signal(scrape, entity_id="brightdata-hello", idx=i + 1) for i, scrape in enumerate(selected)]

            if not signals:
                report["ralph_pass2"]["status"] = "skipped_no_usable_scrapes"
            else:
                original_query = claude.query
                prompt_logs: List[Dict[str, Any]] = []

                async def wrapped_query(*, prompt: str, model: str = "haiku", max_tokens: int = 2000, tools=None, system_prompt=None):
                    prompt_idx = len(prompt_logs) + 1
                    prompt_file = prompts_dir / f"prompt_{prompt_idx:02d}.txt"
                    prompt_file.write_text(prompt, encoding="utf-8")
                    result = await original_query(
                        prompt=prompt,
                        model=model,
                        max_tokens=max_tokens,
                        tools=tools,
                        system_prompt=system_prompt,
                    )
                    response_text = result if isinstance(result, str) else json.dumps(result, default=str)
                    response_file = prompts_dir / f"response_{prompt_idx:02d}.txt"
                    response_file.write_text(response_text, encoding="utf-8")
                    prompt_logs.append(
                        {
                            "idx": prompt_idx,
                            "model": model,
                            "max_tokens": max_tokens,
                            "prompt_chars": len(prompt),
                            "prompt_file": str(prompt_file),
                            "response_file": str(response_file),
                            "response_chars": len(response_text),
                        }
                    )
                    return result

                claude.query = wrapped_query  # type: ignore[assignment]
                validated = await ralph._pass2_claude_validation(signals, entity_id="brightdata-hello")
                report["ralph_pass2"] = {
                    "status": "completed",
                    "input_signal_count": len(signals),
                    "validated_signal_ids": [s.id for s in validated],
                    "validated_confidences": {s.id: s.confidence for s in validated},
                    "prompt_logs": prompt_logs,
                }
    finally:
        await brightdata.close()

    report_file = run_dir / "report.json"
    report_file.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(str(report_file))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="BrightData long-form hello verification")
    parser.add_argument(
        "--query",
        default="Coventry City FC procurement digital transformation official site tenders partnerships latest announcements",
    )
    parser.add_argument("--num-results", type=int, default=8)
    parser.add_argument("--max-scrapes", type=int, default=4)
    parser.add_argument("--max-signals", type=int, default=2)
    parser.add_argument("--run-pass2", action="store_true")
    parser.add_argument("--pass2-batch-size", type=int, default=1)
    parser.add_argument("--pass2-parallelism", type=int, default=1)
    parser.add_argument("--pass2-evidence-chars", type=int, default=2400)
    parser.add_argument("--output-dir", default="")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run(parse_args())))
