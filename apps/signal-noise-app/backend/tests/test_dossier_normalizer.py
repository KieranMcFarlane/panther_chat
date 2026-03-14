import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dossier_normalizer import normalize_dossier


def test_normalize_dossier_quarantines_malformed_sections():
    source = {
        "entity_id": "fiba",
        "entity_name": "FIBA",
        "sections": [
            {
                "id": "current_performance",
                "title": "Current performance metrics",
                "content": [
                    "Constraints: No markdown",
                    "Decision on truncation: Option A",
                ],
                "confidence": 0.7,
            }
        ],
    }

    normalized = normalize_dossier(source)
    assert normalized["claims"] == []
    assert len(normalized["quarantined_sections"]) == 1
    assert normalized["quarantined_sections"][0]["section_id"] == "current_performance"


def test_normalize_dossier_quarantines_prompt_scaffolding_sections():
    source = {
        "entity_id": "fiba",
        "entity_name": "FIBA",
        "sections": [
            {
                "id": "core_information",
                "title": "Basic entity information",
                "content": [
                    "Keys: content, metrics, insights, recommendations, confidence? Yes.",
                    "Return JSON only.",
                ],
                "confidence": 0.5,
            }
        ],
    }

    normalized = normalize_dossier(source)
    assert normalized["claims"] == []
    assert len(normalized["quarantined_sections"]) == 1
    assert normalized["quarantined_sections"][0]["section_id"] == "core_information"


def test_normalize_dossier_splits_claim_layers_and_claim_confidence():
    source = {
        "entity_id": "fiba",
        "entity_name": "FIBA",
        "sections": [
            {
                "id": "core_information",
                "title": "Basic entity information",
                "content": [
                    "FIBA was founded in 1932 [evidence_level=verified; source_type=official; last_verified_at=2026-03-10; needs_review=false]",
                    "Likely prioritizing digital fan engagement in next cycle.",
                    "Run a 90-day outbound campaign for federation partnerships.",
                ],
                "confidence": 0.8,
            }
        ],
    }

    normalized = normalize_dossier(source)
    assert len(normalized["claims"]) == 3
    layers = {claim["layer"] for claim in normalized["claims"]}
    assert layers == {"facts", "intelligence", "actions"}
    for claim in normalized["claims"]:
        assert 0.0 <= float(claim["claim_confidence"]) <= 1.0


def test_normalize_dossier_flags_speculative_numeric_claims():
    source = {
        "entity_id": "fiba",
        "entity_name": "FIBA",
        "sections": [
            {
                "id": "recent_news",
                "title": "Recent news",
                "content": ["450M+ players targeted by 2030"],
                "confidence": 0.6,
            }
        ],
    }

    normalized = normalize_dossier(source)
    assert len(normalized["claims"]) == 1
    assert normalized["claims"][0]["speculative_numeric"] is True
    assert normalized["claims"][0]["needs_review"] is True
