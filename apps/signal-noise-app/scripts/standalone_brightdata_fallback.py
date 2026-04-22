#!/usr/bin/env python3
"""Standalone direct BrightData fallback for question-source debug runs."""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from brightdata_sdk_client import BrightDataSDKClient  # noqa: E402
from brightdata_mcp_client import BrightDataHTTPClient  # noqa: E402


def _load_env() -> None:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)


def _canonical_text(*parts: Any) -> str:
    return " ".join(str(part or "").strip() for part in parts if str(part or "").strip())


def _summarise_results(results: List[Dict[str, Any]]) -> str:
    lines = []
    for item in results[:3]:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        if title and snippet:
            lines.append(f"{title}: {snippet}")
        elif title:
            lines.append(title)
        elif snippet:
            lines.append(snippet)
    return " ".join(lines).strip()


def _extract_named_phrase(text: str, patterns: List[str], fallback: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            groups = [group for group in match.groups() if group]
            if groups:
                return str(groups[0]).strip()
    return fallback


def _append_signal(bucket: List[Dict[str, Any]], *, name: str, url: str, evidence_kind: str, summary: str) -> None:
    if not name:
        return
    if any(str(item.get("name") or "").strip().lower() == name.strip().lower() for item in bucket):
        return
    bucket.append(
        {
            "name": name.strip(),
            "evidence_url": url.strip(),
            "evidence_kind": evidence_kind,
            "summary": summary.strip()[:240],
        }
    )


def _build_q7_signal(results: List[Dict[str, Any]], scrape_preview: str) -> Dict[str, List[Dict[str, Any]]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {
        "vendor_changes": [],
        "platform_migrations": [],
        "partnerships": [],
        "org_changes": [],
    }
    combined_scrape = str(scrape_preview or "")
    for item in results[:5]:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        url = str(item.get("url") or "").strip()
        haystack = _canonical_text(title, snippet, combined_scrape)
        summary = _canonical_text(title, snippet)
        lowered = haystack.lower()

        if any(token in lowered for token in ("kambi", "sbtech", "provider", "vendor", "sportsbook")):
            name = _extract_named_phrase(
                haystack,
                [r"\b(Kambi|SBTech|OpenBet|Genius Sports|Sportradar)\b"],
                title or "Vendor change signal",
            )
            _append_signal(buckets["vendor_changes"], name=name, url=url, evidence_kind="vendor_change", summary=summary)

        if any(token in lowered for token in ("migration", "platform", "stack", "consolidation")):
            name = _extract_named_phrase(
                haystack,
                [r"\b(Kambi|SBTech|platform migration|sportsbook platform)\b"],
                title or "Platform migration signal",
            )
            _append_signal(buckets["platform_migrations"], name=name, url=url, evidence_kind="platform_migration", summary=summary)

        if any(token in lowered for token in ("partnership", "partner", "xai", "rights", "streaming", "sponsorship")):
            kind = "commercial_sponsorship" if "sponsorship" in lowered else "strategic_partnership"
            name = _extract_named_phrase(
                haystack,
                [r"\b(xAI|Kambi|Virgin Bet|Goodwood|strategic partnership)\b"],
                title or "Partnership signal",
            )
            _append_signal(buckets["partnerships"], name=name, url=url, evidence_kind=kind, summary=summary)

        if any(token in lowered for token in ("restructur", "roles impacted", "market exit", "exit", "expansion")):
            name = _extract_named_phrase(
                haystack,
                [r"\b(Netherlands exit|Bulgaria exit|restructuring|expansion)\b"],
                title or "Organisation change signal",
            )
            _append_signal(buckets["org_changes"], name=name, url=url, evidence_kind="org_change", summary=summary)

    return buckets


def _q7_answer(structured_signal: Dict[str, List[Dict[str, Any]]]) -> str:
    parts: List[str] = []
    if structured_signal["vendor_changes"]:
        parts.append(f"vendor changes such as {structured_signal['vendor_changes'][0]['name']}")
    if structured_signal["platform_migrations"]:
        parts.append(f"platform migration signals like {structured_signal['platform_migrations'][0]['name']}")
    if structured_signal["partnerships"]:
        parts.append(f"partnership evidence including {structured_signal['partnerships'][0]['name']}")
    if structured_signal["org_changes"]:
        parts.append(f"org-change signals such as {structured_signal['org_changes'][0]['name']}")
    if not parts:
        return ""
    return f"Direct BrightData fallback found ecosystem-change evidence through {'; '.join(parts)}."


async def _run(question: Dict[str, Any]) -> Dict[str, Any]:
    client = BrightDataSDKClient()
    http_client = BrightDataHTTPClient()
    query = str(question.get("query") or question.get("question_text") or "").strip()
    question_id = str(question.get("question_id") or "").strip()
    question_type = str(question.get("question_type") or "").strip().lower()
    entity_name = str(question.get("entity_name") or "").strip()
    entity_core = re.sub(r"\s*\([^)]*\)\s*$", "", entity_name).strip() or entity_name

    def query_variants() -> List[str]:
        variants = [query]
        if question_id == "q7_procurement_signal" or question_type in {"procurement", "procurement_signal"}:
            variants.extend(
                [
                    f'"{entity_core}" Kambi partnership sportsbook platform',
                    f'"{entity_core}" platform migration partnership',
                    f'"{entity_core}" provider vendor platform',
                ]
            )
        elif question_id == "q8_explicit_rfp":
            variants.extend(
                [
                    f'"{entity_core}" tender RFP procurement',
                    f'"{entity_core}" supplier invitation procurement',
                ]
            )
        elif question_id == "q10_hiring_signal":
            variants.extend(
                [
                    f'"{entity_core}" careers product engineering jobs',
                    f'"{entity_core}" hiring product marketing engineering',
                ]
            )
        deduped = []
        seen = set()
        for item in variants:
            normalized = item.strip()
            if normalized and normalized not in seen:
                deduped.append(normalized)
                seen.add(normalized)
        return deduped

    async def search_with_fallback() -> List[Dict[str, Any]]:
        for variant in query_variants():
            search = await client.search_engine(variant, engine="google", num_results=5)
            results = list(search.get("results") or []) if search.get("status") == "success" else []
            if results:
                return results
        for variant in query_variants():
            search = await http_client.search_engine(variant, engine="google", num_results=5)
            results = list(search.get("results") or []) if search.get("status") == "success" else []
            if results:
                return results
        return []

    try:
        results = await search_with_fallback()
        sources = [str(item.get("url") or "").strip() for item in results if str(item.get("url") or "").strip()][:5]

        scrape_preview = ""
        if sources:
            scrape = await client.scrape_as_markdown(sources[0])
            if scrape.get("status") != "success":
                scrape = await http_client.scrape_as_markdown(sources[0])
            scrape_preview = str(scrape.get("content") or "")[:1200] if scrape.get("status") == "success" else ""

        context = _canonical_text(_summarise_results(results), scrape_preview[:600])
        if question_id == "q7_procurement_signal" or question_type in {"procurement", "procurement_signal"}:
            structured_signal = _build_q7_signal(results, scrape_preview)
            named_count = sum(len(values) for values in structured_signal.values())
            answer = _q7_answer(structured_signal)
            confidence = 0.72 if named_count >= 2 and len(sources) >= 2 else (0.58 if sources else 0.0)
            evidence_grade = "moderate" if named_count >= 2 and len(sources) >= 2 else ("weak" if sources else None)
            return {
                "question": str(question.get("question_text") or "").strip(),
                "answer": answer,
                "context": context[:1600],
                "sources": sources,
                "confidence": confidence,
                "structured_signal": structured_signal,
                "evidence_grade": evidence_grade,
            }

        if question_id == "q8_explicit_rfp":
            return {
                "question": str(question.get("question_text") or "").strip(),
                "answer": "",
                "context": context[:1200],
                "sources": sources,
                "confidence": 0.0,
                "procurement_model": "partner_led" if re.search(r"partner|provider|platform|rights", context, re.I) else "private_direct",
                "evidence_grade": "weak" if sources else None,
            }

        if question_id == "q10_hiring_signal":
            hiring_terms = bool(re.search(r"career|hiring|engineer|product|marketing|job", context, re.I))
            return {
                "question": str(question.get("question_text") or "").strip(),
                "answer": "Direct BrightData fallback found public hiring signals across product and engineering roles." if hiring_terms and sources else "",
                "context": context[:1400],
                "sources": sources,
                "confidence": 0.58 if hiring_terms and sources else 0.0,
                "evidence_grade": "weak" if hiring_terms and sources else None,
            }

        return {
            "question": str(question.get("question_text") or "").strip(),
            "answer": context[:400] if sources else "",
            "context": context[:1400],
            "sources": sources,
            "confidence": 0.55 if sources else 0.0,
        }
    finally:
        await client.close()


def main() -> int:
    _load_env()
    payload = json.loads(sys.stdin.read() or "{}")
    question = payload.get("question") or {}
    result = asyncio.run(_run(question))
    sys.stdout.write(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
