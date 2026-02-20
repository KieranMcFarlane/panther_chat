#!/usr/bin/env python3
"""
Comparison Test: Deterministic vs Probabilistic Scoring

Demonstrates how the new probabilistic scoring system breaks symmetry
compared to the old deterministic approach.
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone, timedelta
from schemas import HypothesisState


def deterministic_recalculate_hypothesis_state(
    entity_id: str,
    category: str,
    capability_signals: list,
    procurement_indicators: list,
    validated_rfps: list
) -> HypothesisState:
    """
    OLD deterministic formula (for comparison)

    Fixed weights: 0.15 per CAPABILITY, 0.25 per PROCUREMENT
    """
    maturity_score = min(1.0, len(capability_signals) * 0.15)
    activity_score = min(1.0, len(procurement_indicators) * 0.25)

    if len(validated_rfps) >= 1:
        state = "LIVE"
    elif activity_score >= 0.6:
        state = "ENGAGE"
    elif activity_score >= 0.4 or maturity_score >= 0.5:
        state = "WARM"
    else:
        state = "MONITOR"

    return HypothesisState(
        entity_id=entity_id,
        category=category,
        maturity_score=maturity_score,
        activity_score=activity_score,
        state=state,
        last_updated=datetime.now(timezone.utc)
    )


def run_comparison():
    """Compare deterministic vs probabilistic scoring"""
    print("="*80)
    print("COMPARISON: Deterministic vs Probabilistic Scoring")
    print("="*80)
    print("\nScenario: 4 Premier League clubs with SAME signal counts")
    print("         but DIFFERENT signal content and ages")
    print()

    from ralph_loop import recalculate_hypothesis_state

    now = datetime.now(timezone.utc)

    # Club 1: High seniority, strong procurement, recent
    club1_capability = [
        {"title": "Chief Digital Officer", "confidence": 0.8, "collected_at": now},
        {"title": "VP of Marketing", "confidence": 0.75, "collected_at": now},
        {"title": "Director of CRM", "confidence": 0.8, "collected_at": now}
    ]
    club1_procurement = [
        {"title": "RFP Issued CRM Platform", "confidence": 0.9, "collected_at": now},
        {"title": "Vendor Selection Process", "confidence": 0.85, "collected_at": now - timedelta(days=7)},
        {"title": "Tender Announcement Analytics", "confidence": 0.9, "collected_at": now - timedelta(days=3)}
    ]

    # Club 2: Medium seniority, medium procurement, mixed ages
    club2_capability = [
        {"title": "CRM Manager", "confidence": 0.7, "collected_at": now - timedelta(days=15)},
        {"title": "Marketing Lead", "confidence": 0.7, "collected_at": now - timedelta(days=20)},
        {"title": "Data Analyst Senior", "confidence": 0.65, "collected_at": now - timedelta(days=10)}
    ]
    club2_procurement = [
        {"title": "Evaluating CRM Options", "confidence": 0.7, "collected_at": now - timedelta(days=25)},
        {"title": "Demo Scheduled Salesforce", "confidence": 0.75, "collected_at": now - timedelta(days=30)},
        {"title": "Proof of Concept Analytics", "confidence": 0.7, "collected_at": now - timedelta(days=20)}
    ]

    # Club 3: Low seniority, weak procurement, old
    club3_capability = [
        {"title": "Salesforce Specialist", "confidence": 0.6, "collected_at": now - timedelta(days=60)},
        {"title": "Marketing Analyst", "confidence": 0.6, "collected_at": now - timedelta(days=75)},
        {"title": "Junior Data Analyst", "confidence": 0.55, "collected_at": now - timedelta(days=90)}
    ]
    club3_procurement = [
        {"title": "Researching CRM Options", "confidence": 0.6, "collected_at": now - timedelta(days=80)},
        {"title": "Partnership Discussion", "confidence": 0.6, "collected_at": now - timedelta(days=70)},
        {"title": "Technology Assessment", "confidence": 0.55, "collected_at": now - timedelta(days=85)}
    ]

    # Club 4: Mixed profile
    club4_capability = [
        {"title": "Director of Digital", "confidence": 0.75, "collected_at": now - timedelta(days=45)},
        {"title": "CRM Manager", "confidence": 0.7, "collected_at": now - timedelta(days=30)},
        {"title": "Analytics Lead", "confidence": 0.7, "collected_at": now - timedelta(days=60)}
    ]
    club4_procurement = [
        {"title": "Exploring New Platforms", "confidence": 0.65, "collected_at": now - timedelta(days=50)},
        {"title": "Vendor Demo", "confidence": 0.7, "collected_at": now - timedelta(days=40)},
        {"title": "Research Phase", "confidence": 0.6, "collected_at": now - timedelta(days=55)}
    ]

    clubs = [
        ("Arsenal (High/Strong/Recent)", club1_capability, club1_procurement),
        ("Chelsea (Medium/Medium/Mixed)", club2_capability, club2_procurement),
        ("Liverpool (Low/Weak/Old)", club3_capability, club3_procurement),
        ("Man City (Mixed profile)", club4_capability, club4_procurement)
    ]

    print("-" * 80)
    print("DETERMINISTIC SCORING (Old: Fixed 0.15 per CAPABILITY, 0.25 per PROCUREMENT)")
    print("-" * 80)
    print(f"{'Club':<25} {'Cap':<4} {'Proc':<4} {'Maturity':<10} {'Activity':<10} {'State':<10}")
    print("-" * 80)

    det_results = []
    for name, cap, proc in clubs:
        state = deterministic_recalculate_hypothesis_state(name.replace(" ", "-").lower(), "TEST", cap, proc, [])
        det_results.append(state)
        print(f"{name:<25} {len(cap):<4} {len(proc):<4} {state.maturity_score:<10.2f} {state.activity_score:<10.2f} {state.state:<10}")

    det_activity_variance = max(s.activity_score for s in det_results) - min(s.activity_score for s in det_results)
    print(f"\nActivity Score Variance: {det_activity_variance:.3f}")

    if det_activity_variance < 0.01:
        print("⚠️  WARNING: All clubs have IDENTICAL scores (modeling artifact!)")

    print("\n" + "-" * 80)
    print("PROBABILISTIC SCORING (New: Content-based + Temporal Decay)")
    print("-" * 80)
    print(f"{'Club':<25} {'Cap':<4} {'Proc':<4} {'Maturity':<10} {'Activity':<10} {'State':<10}")
    print("-" * 80)

    prob_results = []
    for name, cap, proc in clubs:
        state = recalculate_hypothesis_state(name.replace(" ", "-").lower(), "TEST", cap, proc, [])
        prob_results.append(state)
        print(f"{name:<25} {len(cap):<4} {len(proc):<4} {state.maturity_score:<10.3f} {state.activity_score:<10.3f} {state.state:<10}")

    prob_activity_variance = max(s.activity_score for s in prob_results) - min(s.activity_score for s in prob_results)
    print(f"\nActivity Score Variance: {prob_activity_variance:.3f}")

    if prob_activity_variance > 0.05:
        print("✅ Clubs have DIFFERENTIATED scores (natural divergence!)")

    print("\n" + "=" * 80)
    print("IMPROVEMENT SUMMARY")
    print("=" * 80)
    print(f"Deterministic Variance: {det_activity_variance:.3f}")
    print(f"Probabilistic Variance: {prob_activity_variance:.3f}")
    print(f"Improvement: {prob_activity_variance / max(det_activity_variance, 0.001):.1f}x")

    # Show state changes
    print("\nState Changes:")
    for i, (name, _, _) in enumerate(clubs):
        old_state = det_results[i].state
        new_state = prob_results[i].state
        if old_state != new_state:
            print(f"  {name:<25} {old_state} → {new_state}")


if __name__ == "__main__":
    run_comparison()
