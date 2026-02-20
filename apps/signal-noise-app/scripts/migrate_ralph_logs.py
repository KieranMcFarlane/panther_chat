#!/usr/bin/env python3
"""
Migrate Ralph Loop logs to state-aware schema

This script migrates existing runtime bindings (1,270 files) from the old
fixed-iteration schema to the new state-aware schema with RalphState
and RalphIterationOutput.

Usage:
    python scripts/migrate_ralph_logs.py --entity netherlands_football_association
    python scripts/migrate_ralph_logs.py --all
    python scripts/migrate_ralph_logs.py --all --backup

Author: Claude Code
Date: 2026-02-01
"""

import json
import argparse
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
import sys

# Add paths
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from schemas import (
    RalphState,
    Hypothesis,
    CategoryStats,
    RalphDecisionType,
    HypothesisAction
)


def migrate_runtime_binding(binding_path: Path) -> Dict[str, Any]:
    """
    Migrate a single runtime binding to new state-aware schema

    Args:
        binding_path: Path to binding JSON file

    Returns:
        Migrated binding dictionary
    """
    with open(binding_path, 'r') as f:
        binding = json.load(f)

    entity_id = binding['entity_id']
    entity_name = binding['entity_name']
    bootstrap_iterations = binding.get('metadata', {}).get('bootstrap_iterations', [])

    print(f"  📝 Migrating {entity_id} ({len(bootstrap_iterations)} iterations)")

    # Initialize RalphState
    ralph_state = RalphState(
        entity_id=entity_id,
        entity_name=entity_name,
        current_confidence=0.20,
        iterations_completed=0,
        confidence_ceiling=0.95
    )

    # Synthesize hypotheses from ACCEPT/WEAK_ACCEPT patterns
    synthesized_hypotheses = _synthesize_hypotheses(bootstrap_iterations, entity_id, entity_name)
    ralph_state.active_hypotheses.extend(synthesized_hypotheses)

    # Migrate each iteration
    migrated_iterations = []
    seen_evidences = []

    for iteration_data in bootstrap_iterations:
        # Map old decision to new type
        old_decision = iteration_data.get('ralph_decision', 'REJECT')
        decision = _map_decision_type(
            old_decision,
            seen_evidences,
            ralph_state.get_category_stats(iteration_data.get('category', 'Unknown'))
        )

        # Build migrated iteration with new fields
        migrated_iteration = {
            **iteration_data,
            'entity_name': entity_name,  # Add if missing
            'novelty_multiplier': 1.0 if old_decision == 'ACCEPT' else 0.6 if old_decision == 'WEAK_ACCEPT' else 0.0,
            'hypothesis_alignment': 0.8 if old_decision == 'ACCEPT' else 0.5 if old_decision == 'WEAK_ACCEPT' else 0.3,
            'ceiling_damping': 1.0 - (iteration_data.get('confidence_before', 0.2) / 0.95) ** 2,
        }

        # Update state
        ralph_state.seen_evidences.append(iteration_data.get('evidence_found', ''))

        category = iteration_data.get('category', 'Unknown')
        category_stats = ralph_state.get_category_stats(category)
        category_stats.total_iterations += 1
        category_stats.last_decision = decision
        category_stats.last_iteration = iteration_data.get('iteration', 0)

        if decision == RalphDecisionType.ACCEPT:
            category_stats.accept_count += 1
        elif decision == RalphDecisionType.WEAK_ACCEPT:
            category_stats.weak_accept_count += 1
        elif decision == RalphDecisionType.REJECT:
            category_stats.reject_count += 1

        ralph_state.iterations_completed += 1
        ralph_state.update_confidence(iteration_data.get('confidence_after', 0.2))

        migrated_iterations.append(migrated_iteration)

    # Update binding with new schema
    binding['ralph_state'] = ralph_state.to_dict()
    binding['metadata']['bootstrap_iterations'] = migrated_iterations

    # Update performance metrics
    if 'performance_metrics' not in binding:
        binding['performance_metrics'] = {}

    binding['performance_metrics']['is_actionable'] = ralph_state.is_actionable
    binding['performance_metrics']['confidence_ceiling'] = ralph_state.confidence_ceiling
    binding['performance_metrics']['categories_saturated'] = [
        cat for cat, stats in ralph_state.category_stats.items()
        if stats.saturation_score >= 0.7
    ]

    iterations_saved = 30 - ralph_state.iterations_completed
    binding['performance_metrics']['cost_savings_percent'] = max(0, (iterations_saved / 30) * 100)

    return binding


def _synthesize_hypotheses(iterations: List[Dict], entity_id: str, entity_name: str) -> List[Hypothesis]:
    """
    Create synthetic hypotheses based on positive decisions

    Args:
        iterations: List of iteration dictionaries
        entity_id: Entity ID
        entity_name: Entity name

    Returns:
        List of synthesized Hypothesis objects
    """
    from collections import defaultdict

    category_iterations = defaultdict(list)
    for it in iterations:
        category = it.get('category', 'Unknown')
        category_iterations[category].append(it)

    hypotheses = []
    for category, iters in category_iterations.items():
        positive_count = sum(
            1 for it in iters
            if it.get('ralph_decision') in ['ACCEPT', 'WEAK_ACCEPT']
        )

        if positive_count == 0:
            continue

        # Determine hypothesis statement based on pattern
        accept_count = sum(1 for it in iters if it.get('ralph_decision') == 'ACCEPT')
        weak_accept_count = sum(1 for it in iters if it.get('ralph_decision') == 'WEAK_ACCEPT')

        if accept_count >= 2:
            statement = f"{entity_name} has active procurement interest in {category}"
        elif weak_accept_count >= 3:
            statement = f"{entity_name} has capability in {category} but unclear procurement intent"
        else:
            statement = f"{entity_name} exploring {category}"

        hypotheses.append(Hypothesis(
            hypothesis_id=f"{entity_id}_{category.lower().replace(' ', '_').replace(',', '_')}_h0",
            entity_id=entity_id,
            category=category,
            statement=statement,
            confidence=0.5 + (positive_count * 0.1),
            reinforced_count=positive_count,
            weakened_count=len(iters) - positive_count
        ))

    return hypotheses


def _map_decision_type(
    old_decision: str,
    seen_evidences: List[str],
    category_stats: CategoryStats
) -> RalphDecisionType:
    """
    Map old decision string to new RalphDecisionType

    Args:
        old_decision: Old decision string (ACCEPT/WEAK_ACCEPT/REJECT)
        seen_evidences: List of seen evidences
        category_stats: Category statistics

    Returns:
        RalphDecisionType enum value
    """
    if old_decision == 'ACCEPT':
        return RalphDecisionType.ACCEPT
    elif old_decision == 'WEAK_ACCEPT':
        # Check if this should be NO_PROGRESS due to saturation
        if category_stats.weak_accept_count >= 2 and category_stats.accept_count == 0:
            return RalphDecisionType.NO_PROGRESS
        return RalphDecisionType.WEAK_ACCEPT
    else:
        return RalphDecisionType.REJECT


def main():
    """Main migration function"""
    parser = argparse.ArgumentParser(
        description="Migrate Ralph Loop logs to state-aware schema"
    )
    parser.add_argument('--entity', type=str, help='Entity ID to migrate')
    parser.add_argument('--all', action='store_true', help='Migrate all runtime bindings')
    parser.add_argument('--backup', action='store_true', help='Create backup before migration')
    parser.add_argument('--runtime-dir', type=str, default='data/runtime_bindings',
                        help='Runtime bindings directory')

    args = parser.parse_args()

    runtime_bindings_dir = Path(args.runtime_dir)

    if not runtime_bindings_dir.exists():
        print(f"❌ Runtime bindings directory not found: {runtime_bindings_dir}")
        return

    # Determine which files to migrate
    if args.entity:
        binding_files = [runtime_bindings_dir / f"{args.entity}.json"]
        if not binding_files[0].exists():
            print(f"❌ Binding file not found: {binding_files[0]}")
            return
    elif args.all:
        binding_files = list(runtime_bindings_dir.glob('*.json'))
        print(f"🔍 Found {len(binding_files)} binding files")
    else:
        parser.print_help()
        return

    # Migrate each binding
    success_count = 0
    error_count = 0

    for binding_file in binding_files:
        try:
            print(f"\n🔄 Migrating {binding_file.name}")

            # Create backup if requested
            if args.backup:
                backup_file = binding_file.with_suffix('.json.backup')
                shutil.copy(binding_file, backup_file)
                print(f"  💾 Backup created: {backup_file.name}")

            # Migrate binding
            migrated_binding = migrate_runtime_binding(binding_file)

            # Save migrated binding
            with open(binding_file, 'w') as f:
                json.dump(migrated_binding, f, indent=2)

            print(f"  ✅ Migrated successfully")
            success_count += 1

        except Exception as e:
            print(f"  ❌ Migration failed: {e}")
            error_count += 1
            continue

    # Print summary
    print(f"\n{'='*80}")
    print(f"Migration complete:")
    print(f"  ✅ Success: {success_count}")
    print(f"  ❌ Errors: {error_count}")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
