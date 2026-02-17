#!/usr/bin/env python3
"""
End-to-End System Demo Orchestrator

This script runs the complete 6-step system demonstration for multiple entities:
1. Question-First Dossier (YP integration)
2. Hypothesis-Driven Discovery (EIG-based)
3. Ralph Loop Validation (3-pass governance)
4. Temporal Intelligence (timeline analysis)
5. Narrative Builder (episode compression)
6. Yellow Panther Scoring (opportunity fit)

Usage:
    python run_end_to_end_demo.py
    python run_end_to_end_demo.py --max-iterations 5
    python run_end_to_end_demo.py --entities arsenal-fc icf

Output:
    Results saved to data/end_to_end_results.json
"""

import os
import sys
import json
import argparse
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))
sys.path.insert(0, str(scripts_dir.parent.parent.parent))  # Project root
sys.path.insert(0, str(scripts_dir.parent.parent.parent / "backend"))

# Import step wrapper and data models
from step_wrappers import SystemStepWrapper
from data_models import (
    EntityExecution,
    DemoExecution,
    StepStatus
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(scripts_dir / "demo_execution.log")
    ]
)
logger = logging.getLogger(__name__)

# Entity configurations for demo
ENTITIES = [
    {
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal FC",
        "entity_type": "SPORT_CLUB"
    },
    {
        "entity_id": "icf",
        "entity_name": "International Canoe Federation",
        "entity_type": "SPORT_FEDERATION"
    },
    {
        "entity_id": "mlc",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE"
    }
]

# Output configuration
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data"
RESULTS_FILE = OUTPUT_DIR / "end_to_end_results.json"


def print_section(title: str, width: int = 80):
    """Print a formatted section header"""
    print("\n" + "=" * width)
    print(f" {title}")
    print("=" * width)


def print_subsection(title: str):
    """Print a formatted subsection header"""
    print(f"\n{'-' * 40}")
    print(f" {title}")
    print('-' * 40)


def format_duration(ms: int) -> str:
    """Format duration in milliseconds to human-readable string"""
    if ms < 1000:
        return f"{ms}ms"
    elif ms < 60000:
        return f"{ms/1000:.1f}s"
    else:
        minutes = int(ms // 60000)
        seconds = (ms % 60000) / 1000
        return f"{minutes}m {seconds:.0f}s"


def format_cost(usd: float) -> str:
    """Format cost in USD"""
    if usd < 0.01:
        return f"${usd*1000:.2f}"
    else:
        return f"${usd:.4f}"


async def run_entity_execution(
    wrapper: SystemStepWrapper,
    entity_config: Dict[str, Any],
    max_iterations: int = 10
) -> EntityExecution:
    """
    Run all 6 steps for a single entity.

    Args:
        wrapper: SystemStepWrapper instance
        entity_config: Dict with entity_id, entity_name, entity_type
        max_iterations: Max iterations for discovery step

    Returns:
        EntityExecution with all step results
    """
    entity_id = entity_config["entity_id"]
    entity_name = entity_config["entity_name"]
    entity_type = entity_config["entity_type"]

    print_subsection(f"Processing: {entity_name} ({entity_type})")

    execution = EntityExecution(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type,
        started_at=datetime.now(timezone.utc).isoformat(),
        completed_at="",
        duration_ms=0,
        cost_usd=0.0,
        steps=[],
        final_confidence=0.0,
        total_signals=0,
        procurement_signals=0,
        capability_signals=0,
        confidence_band="",
        estimated_value="",
        recommendations=[]
    )

    start_time = datetime.now(timezone.utc)

    try:
        # Run all 6 steps
        steps = await wrapper.run_all_steps(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            max_iterations=max_iterations
        )

        # Add steps to execution
        for step in steps:
            execution.steps.append(step)
            execution.cost_usd += step.cost_usd

        # Extract final metrics from step outputs
        if steps:
            # Get final confidence from discovery
            discovery_step = next((s for s in steps if s.step_number == 2), None)
            if discovery_step:
                execution.final_confidence = discovery_step.output_data.get("final_confidence", 0.0)

            # Get signal counts from Ralph Loop
            ralph_step = next((s for s in steps if s.step_number == 3), None)
            if ralph_step:
                validated = ralph_step.output_data.get("validated_signals", [])
                execution.total_signals = len(validated)
                # Count signal types
                for sig in validated:
                    if sig.get("type") == "RFP_DETECTED":
                        execution.procurement_signals += 1
                    else:
                        execution.capability_signals += 1

            # Get confidence band
            if execution.final_confidence >= 0.80:
                execution.confidence_band = "ACTIONABLE"
                execution.estimated_value = "$5,000/entity/month"
            elif execution.final_confidence >= 0.60:
                execution.confidence_band = "CONFIDENT"
                execution.estimated_value = "$2,000/entity/month"
            elif execution.final_confidence >= 0.30:
                execution.confidence_band = "INFORMED"
                execution.estimated_value = "$500/entity/month"
            else:
                execution.confidence_band = "EXPLORATORY"
                execution.estimated_value = "$0"

            # Get recommendations from YP scoring
            yp_step = next((s for s in steps if s.step_number == 6), None)
            if yp_step:
                recommendations = yp_step.output_data.get("recommendations", [])
                execution.recommendations = [
                    {"text": r} if isinstance(r, str) else r
                    for r in recommendations
                ]

        # Print step summary for entity
        print(f"\n  Steps Completed: {len([s for s in steps if s.status == StepStatus.SUCCESS])}/{len(steps)}")
        print(f"  Final Confidence: {execution.final_confidence:.2f}")
        print(f"  Total Signals: {execution.total_signals}")
        print(f"  Confidence Band: {execution.confidence_band}")
        print(f"  Total Cost: {format_cost(execution.cost_usd)}")

    except Exception as e:
        logger.error(f"Error executing {entity_name}: {e}", exc_info=True)
        print(f"\n  ERROR: {str(e)}")

    # Finalize execution
    execution.completed_at = datetime.now(timezone.utc).isoformat()
    execution.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

    return execution


def calculate_summary_metrics(executions: List[EntityExecution]) -> Dict[str, Any]:
    """
    Calculate summary metrics across all entity executions.

    Args:
        executions: List of EntityExecution objects

    Returns:
        Dict with summary metrics
    """
    if not executions:
        return {}

    successful = [e for e in executions if e.steps]
    total_steps = sum(len(e.steps) for e in executions)
    successful_steps = sum(
        len([s for s in e.steps if s.status == StepStatus.SUCCESS])
        for e in executions
    )

    # Confidence statistics
    confidences = [e.final_confidence for e in executions]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    max_confidence = max(confidences) if confidences else 0.0
    min_confidence = min(confidences) if confidences else 0.0

    # Cost statistics
    total_cost = sum(e.cost_usd for e in executions)
    avg_cost = total_cost / len(executions) if executions else 0.0

    # Signal statistics
    total_signals = sum(e.total_signals for e in executions)
    procurement_signals = sum(e.procurement_signals for e in executions)
    capability_signals = sum(e.capability_signals for e in executions)

    # Duration statistics
    durations = [e.duration_ms for e in executions]
    avg_duration_ms = sum(durations) / len(durations) if durations else 0
    total_duration_ms = sum(durations)

    # Confidence band distribution
    bands = {}
    for e in executions:
        band = e.confidence_band or "UNKNOWN"
        bands[band] = bands.get(band, 0) + 1

    return {
        "total_entities": len(executions),
        "successful_entities": len(successful),
        "total_steps": total_steps,
        "successful_steps": successful_steps,
        "success_rate": successful_steps / total_steps if total_steps > 0 else 0.0,
        "avg_confidence": avg_confidence,
        "max_confidence": max_confidence,
        "min_confidence": min_confidence,
        "total_cost_usd": total_cost,
        "avg_cost_usd": avg_cost,
        "total_signals": total_signals,
        "procurement_signals": procurement_signals,
        "capability_signals": capability_signals,
        "avg_duration_ms": avg_duration_ms,
        "total_duration_ms": total_duration_ms,
        "confidence_bands": bands
    }


def print_completion_summary(demo: DemoExecution):
    """
    Print completion summary for the demo execution.

    Args:
        demo: DemoExecution object with results
    """
    print_section("DEMO EXECUTION COMPLETE")

    print(f"\n  Version: {demo.version}")
    print(f"  Generated: {demo.generated_at}")
    print(f"  Total Duration: {format_duration(demo.total_duration_ms)}")
    print(f"  Total Cost: {format_cost(demo.total_cost_usd)}")

    if demo.summary:
        summary = demo.summary
        print(f"\n  Entities Processed: {summary.get('total_entities', 0)}")
        print(f"  Successful: {summary.get('successful_entities', 0)}")
        print(f"  Steps Completed: {summary.get('successful_steps', 0)}/{summary.get('total_steps', 0)}")
        print(f"  Success Rate: {summary.get('success_rate', 0):.1%}")

        print(f"\n  Confidence Statistics:")
        print(f"    Average: {summary.get('avg_confidence', 0):.2f}")
        print(f"    Max: {summary.get('max_confidence', 0):.2f}")
        print(f"    Min: {summary.get('min_confidence', 0):.2f}")

        print(f"\n  Signal Statistics:")
        print(f"    Total Signals: {summary.get('total_signals', 0)}")
        print(f"    Procurement: {summary.get('procurement_signals', 0)}")
        print(f"    Capability: {summary.get('capability_signals', 0)}")

        print(f"\n  Confidence Bands:")
        for band, count in summary.get('confidence_bands', {}).items():
            print(f"    {band}: {count}")

    print(f"\n  Results saved to: {RESULTS_FILE}")

    # Print per-entity summary
    print(f"\n  Per-Entity Results:")
    for entity in demo.entities:
        print(f"\n    {entity.entity_name} ({entity.entity_type})")
        print(f"      Confidence: {entity.final_confidence:.2f}")
        print(f"      Band: {entity.confidence_band}")
        print(f"      Signals: {entity.total_signals}")
        print(f"      Cost: {format_cost(entity.cost_usd)}")
        print(f"      Duration: {format_duration(entity.duration_ms)}")

        if entity.recommendations:
            print(f"      Top Recommendations:")
            for rec in entity.recommendations[:3]:
                text = rec.get("text", rec) if isinstance(rec, dict) else rec
                print(f"        - {text[:80]}...")

    print("\n" + "=" * 80)


async def main(max_iterations: int = 10, entity_filter: Optional[List[str]] = None):
    """
    Main orchestrator for end-to-end demo.

    Args:
        max_iterations: Maximum iterations for discovery step
        entity_filter: Optional list of entity_ids to process (default: all)
    """
    print_section("END-TO-END SYSTEM DEMO")

    # Filter entities if requested
    entities_to_process = ENTITIES
    if entity_filter:
        entities_to_process = [
            e for e in ENTITIES if e["entity_id"] in entity_filter
        ]
        if not entities_to_process:
            print(f"\n  ERROR: No matching entities found for filter: {entity_filter}")
            print(f"  Available entities: {[e['entity_id'] for e in ENTITIES]}")
            return

    print(f"\n  Configuration:")
    print(f"    Entities to process: {len(entities_to_process)}")
    for entity in entities_to_process:
        print(f"      - {entity['entity_name']} ({entity['entity_id']})")
    print(f"    Max iterations per entity: {max_iterations}")
    print(f"    Output directory: {OUTPUT_DIR}")
    print(f"    Results file: {RESULTS_FILE}")

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize wrapper
    wrapper = SystemStepWrapper(output_dir=str(OUTPUT_DIR / "demo_steps"))

    # Create demo execution object
    demo = DemoExecution(
        version="1.0.0",
        generated_at="",
        total_duration_ms=0,
        total_cost_usd=0.0,
        entities=[],
        summary={}
    )

    demo_start = datetime.now(timezone.utc)

    try:
        # Process each entity
        print(f"\n  Processing {len(entities_to_process)} entities...")

        for i, entity_config in enumerate(entities_to_process, 1):
            print(f"\n  [{i}/{len(entities_to_process)}] {entity_config['entity_name']}")

            execution = await run_entity_execution(
                wrapper=wrapper,
                entity_config=entity_config,
                max_iterations=max_iterations
            )

            demo.entities.append(execution)
            demo.total_cost_usd += execution.cost_usd

        # Calculate summary metrics
        demo.summary = calculate_summary_metrics(demo.entities)

        # Finalize demo
        demo.generated_at = datetime.now(timezone.utc).isoformat()
        demo.total_duration_ms = int(
            (datetime.now(timezone.utc) - demo_start).total_seconds() * 1000
        )

        # Save results
        demo.save(str(RESULTS_FILE))

        # Print completion summary
        print_completion_summary(demo)

        logger.info(f"Demo completed successfully. Results saved to {RESULTS_FILE}")

    except KeyboardInterrupt:
        print("\n\n  Demo interrupted by user.")
        logger.info("Demo interrupted")
    except Exception as e:
        print(f"\n\n  ERROR: Demo failed: {str(e)}")
        logger.error(f"Demo failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run end-to-end system demonstration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full demo for all entities
  python run_end_to_end_demo.py

  # Run with reduced iterations for faster testing
  python run_end_to_end_demo.py --max-iterations 5

  # Run for specific entities only
  python run_end_to_end_demo.py --entities arsenal-fc icf

  # Run single entity with minimal iterations
  python run_end_to_end_demo.py --entities arsenal-fc --max-iterations 3
        """
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=10,
        help="Maximum iterations for discovery step (default: 10)"
    )

    parser.add_argument(
        "--entities",
        nargs="+",
        choices=[e["entity_id"] for e in ENTITIES],
        help="Specific entities to process (default: all)"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Run the demo
    asyncio.run(main(
        max_iterations=args.max_iterations,
        entity_filter=args.entities
    ))
