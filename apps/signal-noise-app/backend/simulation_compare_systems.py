#!/usr/bin/env python3
"""
System Comparison Simulation: Old Ralph Loop vs Hypothesis-Driven Discovery

Simulates 100 entities under both systems to compare:
- Cost per entity
- Iterations per entity
- Actionables discovered
- Confidence achieved
- Total cost and throughput
"""

import asyncio
import random
import statistics
from dataclasses import dataclass, field
from typing import List, Dict, Tuple
from datetime import datetime
from enum import Enum


class DecisionType(Enum):
    ACCEPT = "ACCEPT"
    WEAK_ACCEPT = "WEAK_ACCEPT"
    REJECT = "REJECT"
    NO_PROGRESS = "NO_PROGRESS"


@dataclass
class EntityCharacteristics:
    """Synthetic entity characteristics for simulation"""
    entity_id: str
    digital_maturity: float  # 0.0-1.0 (high maturity = easier to detect signals)
    signal_density: float  # 0.0-1.0 (high density = more actionables)
    market_activity: float  # 0.0-1.0 (high activity = more job postings, tenders)


@dataclass
class SimulationResult:
    """Results from running one entity through a system"""
    entity_id: str
    iterations: int
    total_cost: float
    final_confidences: Dict[str, float]
    actionables_found: int
    hypotheses_status: Dict[str, str]
    avg_confidence: float


class OldRalphLoopSimulator:
    """
    Simulates the OLD Ralph Loop:
    - Fixed 30 iterations per entity
    - Random exploration (no prioritization)
    - No early termination
    - No hypothesis tracking
    """

    def __init__(self, cost_per_hop=0.02):
        self.cost_per_hop = cost_per_hop

    def simulate(self, entity: EntityCharacteristics) -> SimulationResult:
        """Simulate old Ralph Loop on an entity"""
        iterations = 30  # Fixed
        total_cost = iterations * self.cost_per_hop

        # Simulate detection based on entity characteristics
        final_confidences = {}
        categories = ["CRM", "Digital Transformation", "C-Suite", "Data Analytics", "Fan Engagement"]

        for category in categories:
            # Detection probability scales with digital maturity and signal density
            base_detection = entity.digital_maturity * entity.signal_density
            detection_prob = base_detection + random.uniform(-0.1, 0.1)
            detection_prob = max(0.0, min(1.0, detection_prob))

            # After 30 iterations, confidence converges to detection probability
            final_confidences[category] = detection_prob

        # Actionables: confidence >0.70 (with no actionable gate check)
        actionables = sum(1 for conf in final_confidences.values() if conf > 0.70)

        avg_confidence = statistics.mean(final_confidences.values())

        return SimulationResult(
            entity_id=entity.entity_id,
            iterations=iterations,
            total_cost=total_cost,
            final_confidences=final_confidences,
            actionables_found=actionables,
            hypotheses_status={cat: "ACTIVE" for cat in categories},
            avg_confidence=avg_confidence
        )


class EarlyStopOnlySimulator:
    """
    Simulates confidence-gated early stopping WITHOUT:
    - EIG prioritization
    - Explicit hypothesis objects
    - Lifecycle management

    Purpose: Isolate the benefit of early stopping alone.
    """

    def __init__(self, cost_per_hop=0.02):
        self.cost_per_hop = cost_per_hop

    def should_stop_early(self, confidences: Dict[str, float], iterations: int) -> bool:
        """Check if we should stop based on confidence thresholds"""
        # High confidence lock-in
        if any(conf >= 0.85 for conf in confidences.values()):
            return True

        # All categories highly confident
        if iterations > 10 and all(conf >= 0.90 for conf in confidences.values()):
            return True

        # Max iterations
        if iterations >= 30:
            return True

        return False

    def simulate(self, entity: EntityCharacteristics) -> SimulationResult:
        """Simulate early-stop-only discovery on an entity"""
        categories = ["CRM", "Digital Transformation", "C-Suite", "Data Analytics", "Fan Engagement"]

        # Simple confidence tracking (no hypothesis objects)
        confidences = {cat: 0.5 for cat in categories}

        total_iterations = 0

        # Discovery loop with early stopping
        while total_iterations < 30:
            # Random category selection (NO EIG prioritization)
            category = random.choice(categories)

            # Execute one hop
            total_iterations += 1

            # Simulate discovery outcome (same logic as new system)
            base_detection = entity.digital_maturity * entity.signal_density
            detection_prob = base_detection + random.uniform(-0.15, 0.15)
            detection_prob = max(0.0, min(1.0, detection_prob))

            # Determine decision type (same as new system)
            rand = random.random()

            if detection_prob > 0.6:
                # Strong signal
                if rand < 0.5:
                    delta = 0.06  # ACCEPT
                else:
                    delta = 0.02  # WEAK_ACCEPT
            elif detection_prob > 0.3:
                # Weak signal
                if rand < 0.3:
                    delta = 0.02  # WEAK_ACCEPT
                else:
                    delta = 0.0   # NO_PROGRESS
            else:
                # No signal or contradictory
                delta = 0.0  # REJECT or NO_PROGRESS

            # Update confidence
            confidences[category] += delta
            confidences[category] = max(0.0, min(1.0, confidences[category]))

            # Check early stopping (after first few iterations)
            if total_iterations > 5:
                if self.should_stop_early(confidences, total_iterations):
                    break

        # Calculate results
        total_cost = total_iterations * self.cost_per_hop
        actionables = sum(1 for conf in confidences.values() if conf >= 0.70)
        hypotheses_status = {cat: ("PROMOTED" if conf >= 0.70 else "ACTIVE") for cat, conf in confidences.items()}
        avg_confidence = statistics.mean(confidences.values())

        return SimulationResult(
            entity_id=entity.entity_id,
            iterations=total_iterations,
            total_cost=total_cost,
            final_confidences=confidences,
            actionables_found=actionables,
            hypotheses_status=hypotheses_status,
            avg_confidence=avg_confidence
        )


class HypothesisDrivenSimulator:
    """
    Simulates the NEW Hypothesis-Driven Discovery:
    - EIG-based prioritization
    - Early termination (PROMOTED/DEGRADED/SATURATED)
    - Lifecycle management
    - Adaptive iterations
    """

    def __init__(self, cost_per_hop=0.02):
        self.cost_per_hop = cost_per_hop

    def calculate_eig(self, confidence: float, novelty: float = 1.0) -> float:
        """Calculate Expected Information Gain"""
        uncertainty = 1.0 - confidence
        category_value = 1.0  # Assume general category
        return uncertainty * novelty * category_value

    def determine_status(self, confidence: float, accepts: int, rejects: int, no_progress: int) -> str:
        """Determine hypothesis lifecycle status"""
        if confidence >= 0.70 and accepts >= 2:
            return "PROMOTED"
        if confidence < 0.30 and rejects >= 2:
            return "DEGRADED"
        if no_progress >= 3:
            return "SATURATED"
        return "ACTIVE"

    def simulate(self, entity: EntityCharacteristics) -> SimulationResult:
        """Simulate hypothesis-driven discovery on an entity"""
        categories = ["CRM", "Digital Transformation", "C-Suite", "Data Analytics", "Fan Engagement"]

        # Initialize hypotheses
        hypotheses = {
            cat: {
                "confidence": 0.5,
                "accepts": 0,
                "rejects": 0,
                "no_progress": 0,
                "status": "ACTIVE",
                "novelty": 1.0
            }
            for cat in categories
        }

        total_iterations = 0
        max_iterations = 30

        # Discovery loop
        while total_iterations < max_iterations:
            # Calculate EIG for all active hypotheses
            active_hypotheses = {k: v for k, v in hypotheses.items() if v["status"] == "ACTIVE"}

            if not active_hypotheses:
                break  # All hypotheses terminated

            # Rank by EIG
            eig_scores = {
                cat: self.calculate_eig(h["confidence"], h["novelty"])
                for cat, h in active_hypotheses.items()
            }

            top_category = max(eig_scores, key=eig_scores.get)

            # Execute one hop
            total_iterations += 1

            # Simulate discovery outcome based on entity characteristics
            base_detection = entity.digital_maturity * entity.signal_density
            detection_prob = base_detection + random.uniform(-0.15, 0.15)
            detection_prob = max(0.0, min(1.0, detection_prob))

            # Determine decision type
            rand = random.random()

            if detection_prob > 0.6:
                # Strong signal
                if rand < 0.5:
                    decision = DecisionType.ACCEPT
                    delta = 0.06
                    hypotheses[top_category]["accepts"] += 1
                else:
                    decision = DecisionType.WEAK_ACCEPT
                    delta = 0.02
                    hypotheses[top_category]["accepts"] += 1
            elif detection_prob > 0.3:
                # Weak signal
                if rand < 0.3:
                    decision = DecisionType.WEAK_ACCEPT
                    delta = 0.02
                    hypotheses[top_category]["accepts"] += 1
                else:
                    decision = DecisionType.NO_PROGRESS
                    delta = 0.0
                    hypotheses[top_category]["no_progress"] += 1
            else:
                # No signal or contradictory
                if rand < 0.3:
                    decision = DecisionType.REJECT
                    delta = 0.0
                    hypotheses[top_category]["rejects"] += 1
                else:
                    decision = DecisionType.NO_PROGRESS
                    delta = 0.0
                    hypotheses[top_category]["no_progress"] += 1

            # Update confidence
            hypotheses[top_category]["confidence"] += delta
            hypotheses[top_category]["confidence"] = max(0.0, min(1.0, hypotheses[top_category]["confidence"]))

            # Reduce novelty (cluster dampening simulation)
            hypotheses[top_category]["novelty"] *= 0.9

            # Check lifecycle transitions
            h = hypotheses[top_category]
            h["status"] = self.determine_status(
                h["confidence"],
                h["accepts"],
                h["rejects"],
                h["no_progress"]
            )

        # Calculate results
        total_cost = total_iterations * self.cost_per_hop
        final_confidences = {cat: h["confidence"] for cat, h in hypotheses.items()}
        actionables = sum(1 for cat, h in hypotheses.items() if h["status"] == "PROMOTED")
        hypotheses_status = {cat: h["status"] for cat, h in hypotheses.items()}
        avg_confidence = statistics.mean(final_confidences.values())

        return SimulationResult(
            entity_id=entity.entity_id,
            iterations=total_iterations,
            total_cost=total_cost,
            final_confidences=final_confidences,
            actionables_found=actionables,
            hypotheses_status=hypotheses_status,
            avg_confidence=avg_confidence
        )


def generate_synthetic_entities(count: int = 100) -> List[EntityCharacteristics]:
    """Generate synthetic entities for simulation"""
    entities = []

    for i in range(count):
        # Generate entity characteristics with realistic distributions
        digital_maturity = random.betavariate(2, 2)  # Bell curve centered at 0.5
        signal_density = random.betavariate(1.5, 2.5)  # Skewed toward lower density
        market_activity = random.betavariate(2, 3)  # Most entities have moderate activity

        entity = EntityCharacteristics(
            entity_id=f"entity_{i+1:04d}",
            digital_maturity=digital_maturity,
            signal_density=signal_density,
            market_activity=market_activity
        )
        entities.append(entity)

    return entities


def print_statistics(old_results: List[SimulationResult], early_stop_results: List[SimulationResult], new_results: List[SimulationResult]):
    """Print comparative statistics"""

    print("\n" + "="*90)
    print("SIMULATION RESULTS: 100 ENTITIES")
    print("="*90)

    # Overall statistics
    old_total_cost = sum(r.total_cost for r in old_results)
    early_total_cost = sum(r.total_cost for r in early_stop_results)
    new_total_cost = sum(r.total_cost for r in new_results)
    old_total_iterations = sum(r.iterations for r in old_results)
    early_total_iterations = sum(r.iterations for r in early_stop_results)
    new_total_iterations = sum(r.iterations for r in new_results)
    old_total_actionables = sum(r.actionables_found for r in old_results)
    early_total_actionables = sum(r.actionables_found for r in early_stop_results)
    new_total_actionables = sum(r.actionables_found for r in new_results)

    print("\n📊 AGGREGATE METRICS")
    print("-" * 90)
    print(f"{'Metric':<40} {'Old':<12} {'Early-Stop':<12} {'Hypothesis':<12} {'vs Old':<15}")
    print("-" * 90)

    cost_savings = ((old_total_cost - new_total_cost) / old_total_cost) * 100
    print(f"{'Total Cost':<40} ${old_total_cost:.2f}     ${early_total_cost:.2f}     ${new_total_cost:.2f}     {cost_savings:+.1f}%")

    iter_reduction = ((old_total_iterations - new_total_iterations) / old_total_iterations) * 100
    print(f"{'Total Iterations':<40} {old_total_iterations:<10} {early_total_iterations:<10} {new_total_iterations:<10} {iter_reduction:+.1f}%")

    if old_total_actionables > 0:
        actionables_increase = ((new_total_actionables - old_total_actionables) / old_total_actionables) * 100
        print(f"{'Total Actionables':<40} {old_total_actionables:<10} {early_total_actionables:<10} {new_total_actionables:<10} {actionables_increase:+.1f}%")
    else:
        print(f"{'Total Actionables':<40} {old_total_actionables:<10} {early_total_actionables:<10} {new_total_actionables:<10} +∞ (old found none)")

    old_avg_cost_per_actionable = old_total_cost / old_total_actionables if old_total_actionables > 0 else 0
    early_avg_cost_per_actionable = early_total_cost / early_total_actionables if early_total_actionables > 0 else 0
    new_avg_cost_per_actionable = new_total_cost / new_total_actionables if new_total_actionables > 0 else 0
    if old_avg_cost_per_actionable > 0:
        actionable_cost_improvement = ((old_avg_cost_per_actionable - new_avg_cost_per_actionable) / old_avg_cost_per_actionable) * 100
        print(f"{'Cost per Actionable':<40} ${old_avg_cost_per_actionable:.2f}     ${early_avg_cost_per_actionable:.2f}     ${new_avg_cost_per_actionable:.2f}     {actionable_cost_improvement:+.1f}%")
    else:
        print(f"{'Cost per Actionable':<40} N/A (old found none)        ${early_avg_cost_per_actionable:.2f}     ${new_avg_cost_per_actionable:.2f}")

    # Causality isolation section
    print("\n🔬 CAUSALITY ISOLATION")
    print("-" * 90)

    # Early stopping impact
    early_stop_savings = ((old_total_cost - early_total_cost) / old_total_cost) * 100
    early_stop_actionable_change = ((early_total_actionables - old_total_actionables) / old_total_actionables * 100) if old_total_actionables > 0 else 0
    print(f"\n💡 Early Stopping Alone:")
    print(f"   Cost reduction: {early_stop_savings:.1f}%")
    print(f"   Actionables change: {early_stop_actionable_change:+.1f}%")

    # EIG + hypotheses impact (beyond early stopping)
    eig_savings = ((early_total_cost - new_total_cost) / early_total_cost) * 100 if early_total_cost > 0 else 0
    eig_actionable_increase = ((new_total_actionables - early_total_actionables) / early_total_actionables * 100) if early_total_actionables > 0 else 0
    print(f"\n🎯 EIG + Hypotheses (beyond early stop):")
    print(f"   Additional cost reduction: {eig_savings:.1f}%")
    print(f"   Additional actionables: {eig_actionable_increase:+.1f}%")

    print(f"\n🏆 CONCLUSION:")
    print(f"   Early stopping explains: {early_stop_savings:.1f}% of cost savings")
    print(f"   EIG + hypotheses explain: {eig_savings:.1f}% of additional cost savings + {eig_actionable_increase:+.1f}% more actionables")

    # Per-entity statistics
    old_avg_cost = statistics.mean(r.total_cost for r in old_results)
    early_avg_cost = statistics.mean(r.total_cost for r in early_stop_results)
    new_avg_cost = statistics.mean(r.total_cost for r in new_results)
    old_avg_iter = statistics.mean(r.iterations for r in old_results)
    early_avg_iter = statistics.mean(r.iterations for r in early_stop_results)
    new_avg_iter = statistics.mean(r.iterations for r in new_results)
    old_std_cost = statistics.stdev(r.total_cost for r in old_results)
    early_std_cost = statistics.stdev(r.total_cost for r in early_stop_results)
    new_std_cost = statistics.stdev(r.total_cost for r in new_results)

    print("\n📊 PER-ENTITY STATISTICS")
    print("-" * 90)
    print(f"{'Metric':<40} {'Old':<12} {'Early-Stop':<12} {'Hypothesis':<12} {'vs Old':<15}")
    print("-" * 90)

    avg_cost_reduction = ((old_avg_cost - new_avg_cost) / old_avg_cost) * 100
    print(f"{'Average Cost per Entity':<40} ${old_avg_cost:.2f}     ${early_avg_cost:.2f}     ${new_avg_cost:.2f}     {avg_cost_reduction:+.1f}%")

    avg_iter_reduction = ((old_avg_iter - new_avg_iter) / old_avg_iter) * 100
    print(f"{'Average Iterations per Entity':<40} {old_avg_iter:.1f}        {early_avg_iter:.1f}        {new_avg_iter:.1f}        {avg_iter_reduction:+.1f}%")

    old_min_cost = min(r.total_cost for r in old_results)
    early_min_cost = min(r.total_cost for r in early_stop_results)
    new_min_cost = min(r.total_cost for r in new_results)
    old_max_cost = max(r.total_cost for r in old_results)
    early_max_cost = max(r.total_cost for r in early_stop_results)
    new_max_cost = max(r.total_cost for r in new_results)

    print(f"{'Min Cost per Entity':<40} ${old_min_cost:.2f}        ${early_min_cost:.2f}        ${new_max_cost:.2f}")
    print(f"{'Max Cost per Entity':<40} ${old_max_cost:.2f}        ${early_max_cost:.2f}        ${new_max_cost:.2f}")

    # Confidence distribution
    old_avg_conf = statistics.mean(r.avg_confidence for r in old_results)
    early_avg_conf = statistics.mean(r.avg_confidence for r in early_stop_results)
    new_avg_conf = statistics.mean(r.avg_confidence for r in new_results)

    print(f"\n📊 CONFIDENCE QUALITY")
    print("-" * 90)
    print(f"{'Average Final Confidence':<40} {old_avg_conf:.3f}        {early_avg_conf:.3f}        {new_avg_conf:.3f}")

    # Lifecycle status distribution (new system only)
    status_counts = {"PROMOTED": 0, "DEGRADED": 0, "SATURATED": 0, "ACTIVE": 0}
    for result in new_results:
        for status in result.hypotheses_status.values():
            status_counts[status] += 1

    print(f"\n📊 NEW SYSTEM: LIFECYCLE DISTRIBUTION")
    print("-" * 90)
    total_hypotheses = sum(status_counts.values())
    for status, count in status_counts.items():
        percentage = (count / total_hypotheses) * 100
        print(f"  {status:<15} {count:>4} hypotheses ({percentage:>5.1f}%)")

    # Detailed breakdown by cost quartile
    print(f"\n📊 COST DISTRIBUTION BREAKDOWN")
    print("-" * 90)

    new_sorted = sorted(new_results, key=lambda r: r.total_cost)
    quartile_size = len(new_sorted) // 4

    quartiles = [
        ("Cheapest 25%", new_sorted[:quartile_size]),
        ("Second 25%", new_sorted[quartile_size:2*quartile_size]),
        ("Third 25%", new_sorted[2*quartile_size:3*quartile_size]),
        ("Most Expensive 25%", new_sorted[3*quartile_size:]),
    ]

    for quartile_name, results in quartiles:
        if results:
            avg_cost = statistics.mean(r.total_cost for r in results)
            avg_iter = statistics.mean(r.iterations for r in results)
            avg_actionables = statistics.mean(r.actionables_found for r in results)
            print(f"  {quartile_name:<20} ${avg_cost:.2f} avg, {avg_iter:.1f} iters, {avg_actionables:.2f} actionables")

    # Top 10 entities by actionables
    print(f"\n🏆 TOP 10 ENTITIES (by actionables found)")
    print("-" * 90)
    print(f"{'Entity ID':<15} {'System':<12} {'Cost':<10} {'Iters':<8} {'Actionables':<12}")
    print("-" * 90)

    old_sorted_by_actionables = sorted(old_results, key=lambda r: r.actionables_found, reverse=True)[:10]
    new_sorted_by_actionables = sorted(new_results, key=lambda r: r.actionables_found, reverse=True)[:10]

    for i in range(10):
        old_r = old_sorted_by_actionables[i]
        new_r = new_sorted_by_actionables[i]
        print(f"{old_r.entity_id:<15} {'OLD':<12} ${old_r.total_cost:<9.2f} {old_r.iterations:<8} {old_r.actionables_found:<12}")
        print(f"{'':15} {'NEW':<12} ${new_r.total_cost:<9.2f} {new_r.iterations:<8} {new_r.actionables_found:<12}")
        if i < 9:
            print(f"{'-'*90}")


def main():
    """Run simulation comparing all three systems"""

    print("\n" + "="*90)
    print("SYSTEM COMPARISON SIMULATION")
    print("Old vs Early-Stop-Only vs Hypothesis-Driven Discovery")
    print("="*90)

    # Generate 100 synthetic entities
    print("\n🎲 Generating 100 synthetic entities...")
    entities = generate_synthetic_entities(100)

    # Simulate old system
    print("\n🔄 Simulating OLD Ralph Loop (fixed 30 iterations)...")
    old_simulator = OldRalphLoopSimulator(cost_per_hop=0.02)
    old_results = [old_simulator.simulate(entity) for entity in entities]
    print(f"   ✅ Completed {len(old_results)} entities")

    # Simulate early-stop-only system
    print("\n🔄 Simulating EARLY-STOP-ONLY (confidence-gated, no EIG)...")
    early_stop_simulator = EarlyStopOnlySimulator(cost_per_hop=0.02)
    early_stop_results = [early_stop_simulator.simulate(entity) for entity in entities]
    print(f"   ✅ Completed {len(early_stop_results)} entities")

    # Simulate new system
    print("\n🔄 Simulating FULL HYPOTHESIS-DRIVEN (EIG + hypotheses)...")
    new_simulator = HypothesisDrivenSimulator(cost_per_hop=0.02)
    new_results = [new_simulator.simulate(entity) for entity in entities]
    print(f"   ✅ Completed {len(new_results)} entities")

    # Print statistics
    print_statistics(old_results, early_stop_results, new_results)

    # Scaling projections
    print("\n" + "="*90)
    print("SCALING PROJECTIONS")
    print("="*90)

    old_avg_cost = statistics.mean(r.total_cost for r in old_results)
    early_avg_cost = statistics.mean(r.total_cost for r in early_stop_results)
    new_avg_cost = statistics.mean(r.total_cost for r in new_results)

    scenarios = [
        ("Current (3,400 entities)", 3400),
        ("Phase 1 (10,000 entities)", 10000),
        ("Phase 2 (100,000 entities)", 100000),
        ("Phase 3 (All UK sports entities, ~500K)", 500000),
    ]

    print(f"\n{'Scenario':<40} {'Old':<12} {'Early-Stop':<12} {'Hypothesis':<12}")
    print("-" * 90)

    for scenario_name, entity_count in scenarios:
        old_cost = old_avg_cost * entity_count
        early_cost = early_avg_cost * entity_count
        new_cost = new_avg_cost * entity_count
        print(f"{scenario_name:<40} ${old_cost:>8,.0f}   ${early_cost:>8,.0f}   ${new_cost:>8,.0f}")

    print("\n" + "="*90)
    print("SIMULATION COMPLETE")
    print("="*90)

    # Save detailed results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"data/simulation_results_3way_{timestamp}.txt"

    with open(output_file, 'w') as f:
        f.write("ENTITY-BY-ENTITY RESULTS (3-WAY COMPARISON)\n")
        f.write("="*90 + "\n\n")

        for i, (old_r, early_r, new_r) in enumerate(zip(old_results, early_stop_results, new_results)):
            f.write(f"Entity: {old_r.entity_id}\n")
            f.write(f"  OLD:           ${old_r.total_cost:.2f}, {old_r.iterations} iters, {old_r.actionables_found} actionables\n")
            f.write(f"  EARLY-STOP:    ${early_r.total_cost:.2f}, {early_r.iterations} iters, {early_r.actionables_found} actionables\n")
            f.write(f"  HYPOTHESIS:    ${new_r.total_cost:.2f}, {new_r.iterations} iters, {new_r.actionables_found} actionables\n")
            f.write(f"  Savings (vs Old): ${old_r.total_cost - new_r.total_cost:.2f} ({((old_r.total_cost - new_r.total_cost)/old_r.total_cost)*100:.1f}%)\n")
            f.write("\n")

    print(f"\n💾 Detailed results saved to: {output_file}")


if __name__ == "__main__":
    main()
