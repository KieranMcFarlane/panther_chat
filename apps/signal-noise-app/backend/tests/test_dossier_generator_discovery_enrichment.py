#!/usr/bin/env python3
"""Tests for discovery-aware dossier enrichment helpers."""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_generator import EntityDossierGenerator


class _FakeClaude:
    async def query(self, **_kwargs):
        return {"content": "{}"}


def _base_dossier():
    return {
        "entity_name": "Arsenal FC",
        "metadata": {"entity_name": "Arsenal FC"},
        "sections": [
            {
                "id": "leadership",
                "content": ["Leadership records are currently sparse for Arsenal FC."],
                "metrics": ["Decision makers identified: 0"],
                "output_status": "degraded",
                "reason_code": "leadership_sparse",
                "confidence": 0.5,
            },
            {
                "id": "recent_news",
                "content": ["No structured recent-news entries were captured for Arsenal FC in this run."],
                "metrics": ["News items captured: 0"],
                "output_status": "degraded",
                "reason_code": "recent_news_empty",
                "confidence": 0.48,
            },
        ],
    }


def test_enrich_dossier_with_discovery_evidence_populates_leadership_and_news():
    generator = EntityDossierGenerator(_FakeClaude())
    dossier = _base_dossier()
    discovery = {
        "signals_discovered": [
            {
                "validation_state": "validated",
                "statement": "Arsenal FC: Jane Doe - Chief Commercial Officer",
                "content": "Arsenal FC appointed Jane Doe as Chief Commercial Officer.",
                "url": "https://www.arsenal.com/news/jane-doe-appointed",
                "subtype": "PRESS_RELEASE",
            }
        ],
        "provisional_signals": [
            {
                "validation_state": "provisional",
                "statement": "Arsenal FC partnership update announced 20 March 2026",
                "content": "Arsenal FC partnership announcement with supplier timeline.",
                "url": "https://www.arsenal.com/news/partnership-update",
                "subtype": "TRUSTED_NEWS",
            }
        ],
        "candidate_evaluations": [],
    }

    enriched = generator.enrich_dossier_with_discovery_evidence(
        dossier_payload=dossier,
        discovery_payload=discovery,
    )

    leadership = next(section for section in enriched["sections"] if section.get("id") == "leadership")
    recent_news = next(section for section in enriched["sections"] if section.get("id") == "recent_news")

    assert leadership["output_status"] == "completed"
    assert any("Jane Doe" in line for line in leadership.get("content") or [])
    assert recent_news["metrics"] == ["News items captured: 2"]
    assert len(recent_news.get("content") or []) >= 1
    assert "discovery_enrichment" in (enriched.get("metadata") or {})


def test_extract_leadership_prefers_json_when_present():
    generator = EntityDossierGenerator(_FakeClaude())
    text = (
        "context before {\"decision_makers\":[{\"name\":\"Alex Smith\",\"role\":\"Head of Digital\","
        "\"linkedin_url\":\"https://linkedin.com/in/alex-smith\"}]} trailing"
    )

    parsed = generator._extract_leadership_from_json_payload(text)

    assert parsed == [
        {
            "name": "Alex Smith",
            "role": "Head of Digital",
            "linkedin_url": "https://linkedin.com/in/alex-smith",
        }
    ]


def test_extract_leadership_fallback_from_prose():
    generator = EntityDossierGenerator(_FakeClaude())
    text = "Arsenal FC announced Jane Roe - Director of Technology and Data Operations."

    parsed = generator._extract_leadership_from_text(text)

    assert parsed
    assert parsed[0]["name"] == "Jane Roe"
    assert "Director" in parsed[0]["role"]
