#!/usr/bin/env python3

from hypothesis_driven_discovery import HypothesisDrivenDiscovery


def test_extract_dossier_section_signals_derives_procurement_and_capability_signals():
    engine = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    dossier = {
        "sections": [
            {
                "id": "recent_news",
                "content": [
                    "The club opened a tender for a new data platform and supplier onboarding.",
                    "General fan update.",
                ],
                "insights": [],
                "recommendations": [],
            },
            {
                "id": "digital_maturity",
                "content": [
                    "Current CRM and analytics integration is fragmented across systems."
                ],
            },
        ]
    }

    signals = engine._extract_dossier_section_signals(dossier)
    types = {signal.get("type") for signal in signals}

    assert "[PROCUREMENT]" in types
    assert "[CAPABILITY]" in types


def test_extract_dossier_section_signals_skips_process_meta_fragments():
    engine = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    dossier = {
        "sections": [
            {
                "id": "outreach_strategy",
                "content": [
                    "Action quality improves when discovery is constrained to grounded channels first.",
                    "Run targeted discovery hops against official announcements and updates.",
                ],
                "insights": [],
                "recommendations": [],
            }
        ]
    }

    signals = engine._extract_dossier_section_signals(dossier)
    assert signals == []


def test_normalize_dossier_signal_skips_process_meta_statements():
    engine = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    signal = {
        "type": "[CAPABILITY]",
        "text": "Re-run recent news collection with source constraints and trigger dossier refresh.",
        "confidence": 0.54,
    }

    normalized = engine._normalize_dossier_signal(signal)
    assert normalized is None
