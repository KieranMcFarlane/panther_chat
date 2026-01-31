#!/usr/bin/env python3
"""
Regression Evaluation Script

Evaluates Signal Noise system against golden fixture dataset to measure:
- Validation accuracy
- Win rate
- False positive rate
- Calibration by score bucket
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from rfc_discovery_schema import discover_rfps_for_entity


async def evaluate_regression(fixture_path: str):
    """
    Evaluate system against golden fixture dataset.

    Args:
        fixture_path: Path to golden_signals.jsonl file

    Returns:
        Dictionary with evaluation metrics
    """
    print(f"\n{'='*80}")
    print("REGRESSION EVALUATION")
    print(f"{'='*80}\n")
    print(f"Fixture: {fixture_path}")

    # Load golden signals
    with open(fixture_path) as f:
        golden_signals = [json.loads(line) for line in f]

    print(f"Total signals in fixture: {len(golden_signals)}\n")

    # Initialize metrics
    results = {
        "total": len(golden_signals),
        "correct_validations": 0,
        "incorrect_validations": 0,
        "true_positives": 0,  # Validated and outcome=win
        "false_positives": 0,  # Validated but outcome=false_positive
        "true_negatives": 0,   # Not validated and outcome=loss
        "false_negatives": 0,  # Not validated but outcome=win
        "wins": 0,
        "losses": 0,
        "false_positive_signals": 0,  # outcome=false_positive
        "score_distribution": {
            "high_correct": 0,   # high confidence + validated correctly
            "high_incorrect": 0,  # high confidence + validated incorrectly
            "low_correct": 0,    # low confidence + validated correctly
            "low_incorrect": 0    # low confidence + validated incorrectly
        }
    }

    # Evaluate each signal
    for i, signal in enumerate(golden_signals, 1):
        print(f"[{i}/{len(golden_signals)}] Testing {signal['entity']} - {signal['category']}...")

        try:
            # Run discovery
            discovery_result = await discover_rfps_for_entity(
                entity_name=signal["entity_name"],
                entity_id=signal["entity"],
                categories=[signal["category"]]
            )

            # Check if any signal was validated
            validated_signals = discovery_result.get("validated_signals", [])
            validated = len(validated_signals) > 0

            # Get actual confidence (use max if multiple signals)
            actual_confidence = 0.0
            if validated_signals:
                actual_confidence = max(s["confidence"] for s in validated_signals)

            # Check validation correctness
            expected_validated = signal["validated"]
            validation_correct = validated == expected_validated

            if validation_correct:
                results["correct_validations"] += 1
            else:
                results["incorrect_validations"] += 1

            # Track outcome
            outcome = signal["outcome"]
            if outcome == "win":
                results["wins"] += 1
                if validated:
                    results["true_positives"] += 1
                else:
                    results["false_negatives"] += 1
            elif outcome == "loss":
                results["losses"] += 1
                if not validated:
                    results["true_negatives"] += 1
                else:
                    results["false_positives"] += 1
            elif outcome == "false_positive":
                results["false_positive_signals"] += 1
                if validated:
                    results["false_positives"] += 1
                else:
                    results["true_negatives"] += 1

            # Track score distribution
            if actual_confidence >= 0.70:
                if validation_correct:
                    results["score_distribution"]["high_correct"] += 1
                else:
                    results["score_distribution"]["high_incorrect"] += 1
            else:
                if validation_correct:
                    results["score_distribution"]["low_correct"] += 1
                else:
                    results["score_distribution"]["low_incorrect"] += 1

            print(f"  Expected validated={signal['validated']}, Actual validated={validated}")
            print(f"  Confidence: {actual_confidence:.2f}, Outcome: {outcome}")
            print(f"  ✓ Correct" if validation_correct else "  ✗ Incorrect")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            results["incorrect_validations"] += 1

    # Calculate derived metrics
    total = results["total"]
    results["accuracy"] = results["correct_validations"] / total if total > 0 else 0.0

    total_outcomes = results["wins"] + results["losses"] + results["false_positive_signals"]
    results["win_rate"] = results["wins"] / total_outcomes if total_outcomes > 0 else 0.0
    results["false_positive_rate"] = results["false_positive_signals"] / total_outcomes if total_outcomes > 0 else 0.0

    # Precision and recall
    total_validated = results["true_positives"] + results["false_positives"]
    total_actual_wins = results["true_positives"] + results["false_negatives"]

    results["precision"] = results["true_positives"] / total_validated if total_validated > 0 else 0.0
    results["recall"] = results["true_positives"] / total_actual_wins if total_actual_wins > 0 else 0.0
    results["f1_score"] = (
        2 * (results["precision"] * results["recall"]) / (results["precision"] + results["recall"])
        if (results["precision"] + results["recall"]) > 0 else 0.0
    )

    # Calibration check
    high_total = results["score_distribution"]["high_correct"] + results["score_distribution"]["high_incorrect"]
    low_total = results["score_distribution"]["low_correct"] + results["score_distribution"]["low_incorrect"]

    results["calibration_high"] = (
        results["score_distribution"]["high_correct"] / high_total if high_total > 0 else 0.0
    )
    results["calibration_low"] = (
        results["score_distribution"]["low_correct"] / low_total if low_total > 0 else 0.0
    )
    results["calibrated"] = results["calibration_high"] > results["calibration_low"]

    return results


def print_results(results: Dict):
    """Print evaluation results in a formatted table"""
    print(f"\n{'='*80}")
    print("EVALUATION RESULTS")
    print(f"{'='*80}\n")

    # Overall metrics
    print("📊 OVERALL METRICS")
    print("-" * 80)
    print(f"Total Signals: {results['total']}")
    print(f"Accuracy: {results['accuracy']:.2%}")
    print(f"Win Rate: {results['win_rate']:.2%}")
    print(f"False Positive Rate: {results['false_positive_rate']:.2%}")

    # Confusion matrix
    print(f"\n🎯 CONFUSION MATRIX")
    print("-" * 80)
    print(f"True Positives (validated + win): {results['true_positives']}")
    print(f"False Positives (validated + loss/fp): {results['false_positives']}")
    print(f"True Negatives (not validated + loss/fp): {results['true_negatives']}")
    print(f"False Negatives (not validated + win): {results['false_negatives']}")

    # Precision/Recall
    print(f"\n📈 PRECISION / RECALL")
    print("-" * 80)
    print(f"Precision: {results['precision']:.2%}")
    print(f"Recall: {results['recall']:.2%}")
    print(f"F1 Score: {results['f1_score']:.2%}")

    # Score distribution
    print(f"\n📊 SCORE DISTRIBUTION")
    print("-" * 80)
    print(f"High Confidence (≥0.70):")
    print(f"  Correct: {results['score_distribution']['high_correct']}")
    print(f"  Incorrect: {results['score_distribution']['high_incorrect']}")
    print(f"  Accuracy: {results['calibration_high']:.2%}")
    print(f"\nLow Confidence (<0.70):")
    print(f"  Correct: {results['score_distribution']['low_correct']}")
    print(f"  Incorrect: {results['score_distribution']['low_incorrect']}")
    print(f"  Accuracy: {results['calibration_low']:.2%}")

    # Calibration check
    print(f"\n✅ CALIBRATION CHECK")
    print("-" * 80)
    if results['calibrated']:
        print(f"✓ PASS: High confidence ({results['calibration_high']:.2%}) > Low confidence ({results['calibration_low']:.2%})")
    else:
        print(f"✗ FAIL: High confidence ({results['calibration_high']:.2%}) <= Low confidence ({results['calibration_low']:.2%})")

    # Success criteria
    print(f"\n🎯 SUCCESS CRITERIA")
    print("-" * 80)
    criteria = [
        ("Accuracy ≥ 80%", results['accuracy'] >= 0.80),
        ("False Positive Rate < 30%", results['false_positive_rate'] < 0.30),
        ("Precision ≥ 70%", results['precision'] >= 0.70),
        ("Recall ≥ 70%", results['recall'] >= 0.70),
        ("Calibrated (high > low)", results['calibrated'])
    ]

    for criterion, passed in criteria:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {criterion}")

    all_passed = all(passed for _, passed in criteria)
    print(f"\n{'='*80}")
    if all_passed:
        print("✅ ALL CRITERIA MET - SYSTEM IS PRODUCTION-READY")
    else:
        print("⚠️  SOME CRITERIA NOT MET - RECOMMEND TUNING")
    print(f"{'='*80}\n")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Evaluate Signal Noise regression against golden fixture")
    parser.add_argument(
        "--fixture",
        type=str,
        default="backend/tests/fixtures/golden_signals.jsonl",
        help="Path to golden fixture JSONL file"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Optional: Save results to JSON file"
    )

    args = parser.parse_args()

    # Run evaluation
    results = await evaluate_regression(args.fixture)

    # Print results
    print_results(results)

    # Save to file if requested
    if args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = args.output.replace(".json", f"_{timestamp}.json")

        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)

        print(f"💾 Results saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
