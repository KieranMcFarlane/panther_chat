#!/usr/bin/env python3
"""
Schema-first deterministic sweep runner.

Goal:
- Resolve dossier fields with a bounded search/scrape loop per field.
- Emit structured step-by-step diagnostics for observability.
- Reuse deterministic candidate scoring from schema_first_pilot.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse, urlunparse

from schema_first_pilot import (
    _default_field_configs,
    _slugify,
    select_best_candidate,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_query(query: str) -> str:
    return " ".join(str(query or "").strip().lower().split())


def _normalize_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
        netloc = (parsed.netloc or "").lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        path = parsed.path or "/"
        normalized = parsed._replace(netloc=netloc, path=path.rstrip("/") or "/", params="", query="", fragment="")
        return urlunparse(normalized)
    except Exception:  # noqa: BLE001
        return raw


def _content_hash(value: str) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


def _entity_tokens(entity_name: str) -> List[str]:
    raw = [chunk.strip().lower() for chunk in str(entity_name or "").replace("-", " ").split()]
    stop = {"fc", "club", "the", "and", "of", "association", "federation"}
    return [token for token in raw if len(token) >= 3 and token not in stop]


def _trusted_domains_from_candidates(entity_name: str, candidates: List[Dict[str, Any]]) -> List[str]:
    trusted = {"wikipedia.org"}
    tokens = _entity_tokens(entity_name)
    for candidate in candidates:
        url = str(candidate.get("url") or "")
        try:
            domain = (urlparse(url).netloc or "").lower()
        except Exception:  # noqa: BLE001
            domain = ""
        if domain.startswith("www."):
            domain = domain[4:]
        if not domain:
            continue
        if any(token in domain for token in tokens):
            trusted.add(domain)
    return sorted(trusted)


async def run_schema_sweep(
    *,
    entity_name: str,
    entity_id: str,
    entity_type: str,
    output_dir: str,
    max_results: int = 8,
    max_candidates_per_query: int = 4,
    field_names: Optional[Iterable[str]] = None,
    max_hops_per_field: Optional[int] = None,
    min_field_confidence: Optional[float] = None,
    brightdata_client=None,
) -> Dict[str, Any]:
    from brightdata_sdk_client import BrightDataSDKClient

    run_profile = str(os.getenv("DISCOVERY_PROFILE", "continuous") or "continuous").strip().lower()
    hops_budget = max(1, int(max_hops_per_field or os.getenv("SCHEMA_SWEEP_MAX_HOPS_PER_FIELD", "3")))
    min_conf = float(min_field_confidence or os.getenv("SCHEMA_SWEEP_MIN_FIELD_CONFIDENCE", "0.55"))
    engine = str(os.getenv("SCHEMA_SWEEP_SEARCH_ENGINE", "google") or "google").strip().lower()
    country = str(os.getenv("SCHEMA_SWEEP_SEARCH_COUNTRY", "us") or "us").strip().lower()

    client = brightdata_client or BrightDataSDKClient()
    owns_client = brightdata_client is None
    query_cache: Dict[str, Dict[str, Any]] = {}
    scrape_cache: Dict[str, Dict[str, Any]] = {}
    step_logs: List[Dict[str, Any]] = []

    field_configs = _default_field_configs(entity_name, entity_type)
    if field_names:
        selected = {name.strip() for name in field_names if str(name).strip()}
        field_configs = [cfg for cfg in field_configs if cfg.name in selected]

    result: Dict[str, Any] = {
        "run_mode": "schema_sweep_single_pass",
        "run_profile": run_profile,
        "entity_name": entity_name,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "generated_at": _utc_now_iso(),
        "fields": {},
        "field_traces": [],
        "unanswered_fields": [],
        "cache_metrics": {
            "search_calls": 0,
            "search_cache_hits": 0,
            "scrape_calls": 0,
            "scrape_cache_hits": 0,
        },
        "sweep_config": {
            "max_hops_per_field": hops_budget,
            "min_field_confidence": min_conf,
            "max_results": max_results,
            "max_candidates_per_query": max_candidates_per_query,
            "search_engine": engine,
            "search_country": country,
        },
    }

    step_id = 0
    for field in field_configs:
        attempts = 0
        query_cursor = 0
        candidates: List[Dict[str, Any]] = []
        trace: Dict[str, Any] = {"field": field.name, "status": "inconclusive", "attempts": 0, "queries": []}
        best: Optional[Dict[str, Any]] = None

        while attempts < hops_budget:
            query = field.queries[query_cursor % len(field.queries)]
            query_cursor += 1
            attempts += 1

            search_key = f"{engine}|{country}|{max_results}|{_normalize_query(query)}"
            search_cache_hit = search_key in query_cache
            started = time.perf_counter()
            search_payload: Dict[str, Any]
            if search_cache_hit:
                search_payload = query_cache[search_key]
                result["cache_metrics"]["search_cache_hits"] += 1
            else:
                result["cache_metrics"]["search_calls"] += 1
                search_payload = await client.search_engine(
                    query=query,
                    engine=engine,
                    num_results=max_results,
                    country=country,
                )
                query_cache[search_key] = search_payload if isinstance(search_payload, dict) else {}
            search_latency_ms = round((time.perf_counter() - started) * 1000.0, 2)
            rows = (search_payload or {}).get("results", []) if isinstance(search_payload, dict) else []
            rows = rows[: max(1, int(max_candidates_per_query))]

            step_logs.append(
                {
                    "step_id": step_id,
                    "ts": _utc_now_iso(),
                    "field": field.name,
                    "action": "search_engine",
                    "args": {"query": query, "engine": engine, "country": country, "max_results": max_results},
                    "cache_hit": search_cache_hit,
                    "latency_ms": search_latency_ms,
                    "status": (search_payload or {}).get("status", "unknown") if isinstance(search_payload, dict) else "unknown",
                    "result_count": len(rows),
                }
            )
            step_id += 1

            query_trace = {"query": query, "candidate_count": len(rows), "candidates": []}
            for row in rows:
                url = row.get("url")
                if not url:
                    continue
                normalized_url = _normalize_url(url)
                scrape_cache_hit = normalized_url in scrape_cache
                scrape_started = time.perf_counter()
                scrape_payload: Dict[str, Any]
                if scrape_cache_hit:
                    scrape_payload = scrape_cache[normalized_url]
                    result["cache_metrics"]["scrape_cache_hits"] += 1
                else:
                    result["cache_metrics"]["scrape_calls"] += 1
                    scrape_payload = await client.scrape_as_markdown(url)
                    scrape_cache[normalized_url] = scrape_payload if isinstance(scrape_payload, dict) else {}
                scrape_latency_ms = round((time.perf_counter() - scrape_started) * 1000.0, 2)
                content = (scrape_payload or {}).get("content", "") if isinstance(scrape_payload, dict) else ""
                content_chars = len(content)
                content_digest = _content_hash(content) if content else None

                step_logs.append(
                    {
                        "step_id": step_id,
                        "ts": _utc_now_iso(),
                        "field": field.name,
                        "action": "scrape_url",
                        "args": {"url": url},
                        "cache_hit": scrape_cache_hit,
                        "latency_ms": scrape_latency_ms,
                        "status": (scrape_payload or {}).get("status", "unknown") if isinstance(scrape_payload, dict) else "unknown",
                        "content_chars": content_chars,
                        "content_hash": content_digest,
                    }
                )
                step_id += 1

                query_trace["candidates"].append(
                    {
                        "url": url,
                        "title": row.get("title", ""),
                        "content_chars": content_chars,
                        "scrape_cache_hit": scrape_cache_hit,
                    }
                )
                candidates.append(
                    {
                        "query": query,
                        "url": url,
                        "title": row.get("title", ""),
                        "content": content,
                    }
                )

            trace["queries"].append(query_trace)
            best = select_best_candidate(
                entity_name=entity_name,
                trusted_domains=_trusted_domains_from_candidates(entity_name, candidates),
                field_name=field.name,
                candidates=candidates,
            )
            if best and str(best.get("value") or "").strip() and float(best.get("confidence") or 0.0) >= min_conf:
                trace["status"] = "verified"
                break

        trace["attempts"] = attempts

        if best and str(best.get("value") or "").strip() and trace["status"] == "verified":
            result["fields"][field.name] = {
                "value": best.get("value"),
                "url": best.get("url"),
                "title": best.get("title"),
                "confidence": best.get("confidence"),
                "score": best.get("score"),
                "evidence": best.get("evidence"),
                "status": "verified",
                "attempts": attempts,
                "parse_path": "deterministic_score",
            }
        else:
            trace["status"] = "inconclusive"
            result["fields"][field.name] = {
                "value": None,
                "url": best.get("url") if isinstance(best, dict) else None,
                "title": best.get("title") if isinstance(best, dict) else None,
                "confidence": best.get("confidence") if isinstance(best, dict) else 0.0,
                "score": best.get("score") if isinstance(best, dict) else 0,
                "evidence": best.get("evidence") if isinstance(best, dict) else "",
                "status": "inconclusive",
                "attempts": attempts,
                "parse_path": "deterministic_score",
            }
            result["unanswered_fields"].append(field.name)

        result["field_traces"].append(trace)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    slug = _slugify(entity_id or entity_name)
    artifact_path = out_dir / f"{slug}_schema_sweep_{stamp}.json"
    step_log_path = out_dir / f"{slug}_schema_sweep_steps_{stamp}.jsonl"

    step_log_path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in step_logs) + ("\n" if step_logs else ""),
        encoding="utf-8",
    )
    result["step_log_path"] = str(step_log_path)
    result["artifact_path"] = str(artifact_path)
    artifact_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if owns_client and hasattr(client, "close"):
        await client.close()
    return result


if __name__ == "__main__":
    import asyncio

    async def _main() -> None:
        payload = await run_schema_sweep(
            entity_name="FIBA",
            entity_id="fiba",
            entity_type="FEDERATION",
            output_dir="backend/data/dossiers",
        )
        print(json.dumps(payload, indent=2))

    asyncio.run(_main())
