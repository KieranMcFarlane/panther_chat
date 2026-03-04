#!/usr/bin/env python3
"""
Baseline monitoring runner for deterministic, hash-based source checks.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional


ScrapeFunc = Callable[[str], Awaitable[Dict[str, Any]]]


class BaselineMonitoringRunner:
    def __init__(self, scrape_func: ScrapeFunc):
        self.scrape_func = scrape_func

    async def run_monitoring(
        self,
        entity_id: str,
        batch_id: str,
        run_id: str,
        canonical_sources: Dict[str, str],
        previous_snapshots: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        previous_snapshot_map = {
            f"{snapshot['page_class']}:{snapshot['url']}": snapshot
            for snapshot in (previous_snapshots or [])
        }

        fetched_pages = 0
        changed_pages = 0
        unchanged_pages = 0
        snapshots: List[Dict[str, Any]] = []
        candidates: List[Dict[str, Any]] = []

        for page_class, url in canonical_sources.items():
            if not url:
                continue

            scraped = await self.scrape_func(url)
            fetched_pages += 1
            content = self._extract_content(scraped)
            content_hash = self._hash_content(content)
            previous_snapshot = previous_snapshot_map.get(f"{page_class}:{url}")
            changed = previous_snapshot is None or previous_snapshot.get("content_hash") != content_hash

            snapshot = {
                "entity_id": entity_id,
                "page_class": page_class,
                "url": url,
                "content_hash": content_hash,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "changed": changed,
                "metadata": {
                    "content_length": len(content),
                },
            }
            snapshots.append(snapshot)

            if not changed:
                unchanged_pages += 1
                continue

            changed_pages += 1
            candidates.extend(
                self._extract_candidates(
                    entity_id=entity_id,
                    batch_id=batch_id,
                    run_id=run_id,
                    page_class=page_class,
                    url=url,
                    content=content,
                    content_hash=content_hash,
                )
            )

        return {
            "entity_id": entity_id,
            "pages_fetched": fetched_pages,
            "pages_changed": changed_pages,
            "pages_unchanged": unchanged_pages,
            "candidate_count": len(candidates),
            "candidates": candidates,
            "snapshots": snapshots,
        }

    def _extract_content(self, scraped: Dict[str, Any]) -> str:
        return (
            scraped.get("content")
            or scraped.get("markdown")
            or scraped.get("text")
            or ""
        ).strip()

    def _hash_content(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _extract_candidates(
        self,
        entity_id: str,
        batch_id: str,
        run_id: str,
        page_class: str,
        url: str,
        content: str,
        content_hash: str,
    ) -> List[Dict[str, Any]]:
        lowered = content.lower()
        keyword_weights = {
            "rfp": 0.45,
            "tender": 0.45,
            "procurement": 0.35,
            "rfq": 0.35,
            "deadline": 0.2,
            "submission": 0.2,
            "crm": 0.15,
            "platform": 0.1,
            "digital": 0.1,
        }
        jobs_keywords = {
            "hiring": 0.2,
            "head of procurement": 0.45,
            "procurement manager": 0.45,
            "crm manager": 0.3,
            "digital transformation": 0.25,
            "vendor": 0.15,
            "platform": 0.1,
        }
        linkedin_keywords = {
            "we are hiring": 0.2,
            "partnership": 0.2,
            "procurement": 0.3,
            "tender": 0.35,
            "rfp": 0.35,
            "vendor": 0.15,
            "platform": 0.1,
            "digital transformation": 0.2,
        }

        score = 0.0
        for keyword, weight in keyword_weights.items():
            if keyword in lowered:
                score += weight

        if page_class == "jobs_board":
            for keyword, weight in jobs_keywords.items():
                if keyword in lowered:
                    score += weight

        if page_class in {"linkedin_posts", "linkedin_company", "linkedin_executive"}:
            for keyword, weight in linkedin_keywords.items():
                if keyword in lowered:
                    score += weight

        if page_class in {"tenders_page", "procurement_page", "document", "procurement_portal"}:
            score += 0.15

        if score < 0.5:
            return []

        excerpt = self._build_excerpt(content)
        candidate_type = self._candidate_type_for_page_class(page_class)
        metadata_keywords = keyword_weights
        if page_class == "jobs_board":
            metadata_keywords = {**keyword_weights, **jobs_keywords}
        elif page_class in {"linkedin_posts", "linkedin_company", "linkedin_executive"}:
            metadata_keywords = {**keyword_weights, **linkedin_keywords}
        validation_payload = self._build_validation_payload(
            page_class=page_class,
            excerpt=excerpt,
            lowered=lowered,
        )

        return [
            {
                "entity_id": entity_id,
                "batch_id": batch_id,
                "run_id": run_id,
                "page_class": page_class,
                "url": url,
                "content_hash": content_hash,
                "candidate_type": candidate_type,
                "score": round(min(score, 1.0), 2),
                "evidence_excerpt": excerpt,
                "metadata": {
                    "matched_keywords": [
                        keyword
                        for keyword in metadata_keywords
                        if keyword in lowered
                    ],
                    "validation_mode": validation_payload["validation_mode"],
                    "requires_llm_validation": validation_payload["requires_llm_validation"],
                    "evidence_pack": validation_payload["evidence_pack"],
                },
            }
        ]

    def _build_excerpt(self, content: str) -> str:
        normalized = " ".join(content.split())
        return normalized[:240]

    def _candidate_type_for_page_class(self, page_class: str) -> str:
        if page_class == "jobs_board":
            return "hiring_signal"
        if page_class in {"linkedin_posts", "linkedin_company", "linkedin_executive"}:
            return "social_signal"
        return "procurement_signal"

    def _build_validation_payload(
        self,
        *,
        page_class: str,
        excerpt: str,
        lowered: str,
    ) -> Dict[str, Any]:
        if page_class == "jobs_board":
            return {
                "validation_mode": "jobs_compact",
                "requires_llm_validation": True,
                "evidence_pack": {
                    "source_type": "jobs_board",
                    "focus": "hiring_and_buying_signal",
                    "excerpt": excerpt,
                    "signals": [
                        keyword
                        for keyword in (
                            "head of procurement",
                            "procurement manager",
                            "crm manager",
                            "digital transformation",
                            "vendor",
                        )
                        if keyword in lowered
                    ],
                },
            }

        if page_class in {"linkedin_posts", "linkedin_company", "linkedin_executive"}:
            return {
                "validation_mode": "social_compact",
                "requires_llm_validation": True,
                "evidence_pack": {
                    "source_type": page_class,
                    "focus": "social_procurement_signal",
                    "excerpt": excerpt,
                    "signals": [
                        keyword
                        for keyword in (
                            "we are hiring",
                            "partnership",
                            "procurement",
                            "tender",
                            "rfp",
                            "vendor",
                            "digital transformation",
                        )
                        if keyword in lowered
                    ],
                },
            }

        return {
            "validation_mode": "page_compact",
            "requires_llm_validation": False,
            "evidence_pack": {
                "source_type": page_class,
                "focus": "page_procurement_signal",
                "excerpt": excerpt,
            },
        }
