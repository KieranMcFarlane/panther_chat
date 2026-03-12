#!/usr/bin/env python3
"""
Schema-first BrightData pilot runner.

Goal:
- Ask field-level dossier questions.
- Perform hop-by-hop BrightData search + scrape.
- Select best evidence per field with deterministic scoring.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from brightdata_sdk_client import BrightDataSDKClient


DEFAULT_TRUSTED_DOMAINS = [
    "wikipedia.org",
]

NOISY_DOMAIN_HINTS = [
    "nlp.stanford.edu",
    "mit.edu",
    "github.com",
    "snap.berkeley.edu",
]


@dataclass
class FieldConfig:
    name: str
    queries: List[str]


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "entity"


def _domain(url: str) -> str:
    try:
        return (urlparse(url).netloc or "").lower()
    except Exception:
        return ""


def _is_binary_url(url: str) -> bool:
    lowered = (url or "").lower()
    return lowered.endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"))


def _tokenize_name(entity_name: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", (entity_name or "").lower())
    stopwords = {"fc", "club", "the", "and", "of", "association", "federation", "international"}
    return [token for token in tokens if len(token) >= 3 and token not in stopwords]


def extract_value_for_field(field_name: str, text: str) -> Optional[str]:
    content = text or ""

    if field_name == "founded_year":
        match = re.search(r"(founded|established)\D{0,20}(18\d{2}|19\d{2}|20\d{2})", content, re.IGNORECASE)
        if match:
            return match.group(2)
        fallback = re.search(r"\b(18\d{2}|19\d{2}|20\d{2})\b", content)
        return fallback.group(1) if fallback else None

    if field_name == "headquarters":
        match = re.search(
            r"(headquarters|head office)[^\n\r:.]{0,120}",
            content,
            re.IGNORECASE,
        )
        if match:
            return match.group(0).strip()
        return None

    if field_name == "procurement_signals":
        hits = re.findall(
            r"\b(tender|procurement|rfp|request for proposal|partnership|platform)\b",
            content,
            re.IGNORECASE,
        )
        if not hits:
            return None
        unique = sorted(set(hit.lower() for hit in hits))
        return ", ".join(unique)

    if field_name == "official_site":
        return None

    return None


def score_candidate(
    *,
    entity_name: str,
    trusted_domains: List[str],
    url: str,
    title: str,
    content: str,
    field_name: str,
) -> int:
    score = 0
    url_lower = (url or "").lower()
    title_lower = (title or "").lower()
    content_lower = (content or "").lower()
    entity_lower = (entity_name or "").lower()
    domain = _domain(url)

    for idx, trusted in enumerate(trusted_domains):
        if trusted in domain:
            score += max(40, 120 - idx * 20)

    for token in _tokenize_name(entity_name):
        if token in domain:
            score += 25

    if entity_lower and (entity_lower in title_lower or entity_lower in content_lower):
        score += 20

    if _is_binary_url(url):
        score -= 30

    for hint in NOISY_DOMAIN_HINTS:
        if hint in domain:
            score -= 100

    value = extract_value_for_field(field_name, content)
    if field_name == "official_site":
        value = url if url else None
    if value:
        score += 80

    score += min(len(content or "") // 300, 40)
    return score


def _confidence_from_score(score: int) -> float:
    if score <= 0:
        return 0.2
    return max(0.2, min(0.95, score / 300.0))


def select_best_candidate(
    *,
    entity_name: str,
    trusted_domains: List[str],
    field_name: str,
    candidates: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    best: Optional[Dict[str, Any]] = None
    for candidate in candidates:
        url = candidate.get("url", "")
        title = candidate.get("title", "")
        content = candidate.get("content", "")
        value = extract_value_for_field(field_name, content)
        if field_name == "official_site":
            value = url if url else None

        score = score_candidate(
            entity_name=entity_name,
            trusted_domains=trusted_domains,
            url=url,
            title=title,
            content=content,
            field_name=field_name,
        )
        record = {
            "query": candidate.get("query"),
            "url": url,
            "title": title,
            "value": value,
            "score": score,
            "confidence": _confidence_from_score(score),
            "evidence": (content[:280] if isinstance(content, str) else ""),
        }
        if best is None or record["score"] > best["score"]:
            best = record
    return best


def _default_field_configs(entity_name: str, entity_type: str) -> List[FieldConfig]:
    # Keep a compact first-pass schema and avoid entity-specific hardcoding.
    base_name = entity_name.strip()
    base = [
        FieldConfig(
            name="official_site",
            queries=[
                f"{base_name} official website",
                f"{base_name} official site",
                f"{base_name} contact",
            ],
        ),
        FieldConfig(
            name="founded_year",
            queries=[
                f"{base_name} founded year",
                f"{base_name} history founded",
                f"site:wikipedia.org {base_name}",
            ],
        ),
        FieldConfig(
            name="headquarters",
            queries=[
                f"{base_name} headquarters location",
                f"{base_name} contact address",
                f"{base_name} where is headquarters",
            ],
        ),
        FieldConfig(
            name="procurement_signals",
            queries=[
                f"{base_name} tender procurement request for proposal",
                f"{base_name} supplier portal",
                f"{base_name} partnership platform",
            ],
        ),
    ]
    if str(entity_type or "").upper() in {"CLUB", "TEAM"}:
        base[-1].queries.append(f"{base_name} stadium technology partner")
    if str(entity_type or "").upper() in {"FEDERATION", "LEAGUE", "ORG", "ORGANIZATION"}:
        base[-1].queries.append(f"{base_name} governance procurement")
    return base


async def run_schema_first_pilot(
    *,
    entity_name: str,
    entity_id: str,
    entity_type: str,
    output_dir: str,
    max_results: int = 8,
    max_candidates_per_query: int = 4,
    field_names: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    client = BrightDataSDKClient()
    cache: Dict[str, str] = {}
    trusted_domains = list(DEFAULT_TRUSTED_DOMAINS)
    field_configs = _default_field_configs(entity_name, entity_type)
    if field_names:
        selected = set(name.strip() for name in field_names if name and name.strip())
        field_configs = [cfg for cfg in field_configs if cfg.name in selected]

    result: Dict[str, Any] = {
        "run_mode": "schema_first_pilot",
        "entity_name": entity_name,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fields": {},
        "field_traces": [],
    }

    try:
        for field in field_configs:
            candidates: List[Dict[str, Any]] = []
            trace: Dict[str, Any] = {
                "field": field.name,
                "queries": [],
            }
            for query in field.queries:
                search_payload = await client.search_engine(
                    query=query,
                    engine="google",
                    num_results=max_results,
                )
                rows = search_payload.get("results", []) if isinstance(search_payload, dict) else []
                rows = rows[:max_candidates_per_query]
                trace_row: Dict[str, Any] = {"query": query, "candidates": []}
                for row in rows:
                    url = row.get("url")
                    title = row.get("title", "")
                    if not url:
                        continue
                    if url not in cache:
                        scraped = await client.scrape_as_markdown(url)
                        cache[url] = (scraped or {}).get("content", "") if isinstance(scraped, dict) else ""
                    content = cache.get(url, "")
                    trace_row["candidates"].append({"url": url, "title": title})
                    candidates.append(
                        {
                            "query": query,
                            "url": url,
                            "title": title,
                            "content": content,
                        }
                    )
                trace["queries"].append(trace_row)

            best = select_best_candidate(
                entity_name=entity_name,
                trusted_domains=trusted_domains,
                field_name=field.name,
                candidates=candidates,
            )
            result["fields"][field.name] = best
            result["field_traces"].append(trace)
            if field.name == "official_site" and best and isinstance(best.get("value"), str):
                official_domain = _domain(best["value"])
                if official_domain and official_domain not in trusted_domains:
                    trusted_domains.insert(0, official_domain)

        unanswered = [name for name, value in result["fields"].items() if not value or not value.get("value")]
        result["unanswered_fields"] = unanswered

        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = out_dir / f"{_slugify(entity_id)}_schema_first_{stamp}.json"
        out_path.write_text(json.dumps(result, indent=2))
        result["artifact_path"] = str(out_path)
        return result
    finally:
        await client.close()
