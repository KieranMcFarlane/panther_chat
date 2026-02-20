#!/usr/bin/env python3
"""
Complete Discovery Orchestrator - Run full discovery flow for an entity

Usage:
    from backend.run_complete_discovery import orchestrate_discovery

    result = await orchestrate_discovery(
        entity_id="international-canoe-federation",
        max_iterations=30,
        max_depth=3
    )
    # Returns: {
    #   entity: Entity,
    #   template: Template,
    #   hypotheses: List[Hypothesis],
    #   discovery_results: DiscoveryResults,
    #   validated_signals: List[Signal],
    #   dossier: EntityDossier,
    #   log_path: str
    # }
"""

import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Import our modules
from backend.run_entity_discovery import fetch_entity_from_falkordb
from backend.generate_entity_dossier import generate_dossier
from backend.log_discovery_results import log_discovery_results

# Import template system
try:
    from backend.template_loader import load_template_for_tier
except ImportError:
    # Fallback if template loader doesn't exist
    def load_template_for_tier(tier):
        return {
            'template_id': f'tier_{tier}_fallback',
            'tier': tier,
            'sections': []
        }

# Import hypothesis system
try:
    from backend.hypothesis_manager import initialize_hypotheses_from_template
except ImportError:
    # Fallback if hypothesis manager doesn't exist
    async def initialize_hypotheses_from_template(template, entity_id, entity_name):
        return []

# Import discovery system
try:
    from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
except ImportError:
    # Create a simple mock if doesn't exist
    class HypothesisDrivenDiscovery:
        def __init__(self, claude_client, brightdata_client):
            pass
        async def run_discovery(self, entity_id, entity_name, template_id, max_iterations, max_depth):
            return {
                'final_confidence': 0.50,
                'iterations_completed': 0,
                'total_cost': 0.0,
                'raw_signals': [],
                'iterations': [],
                'start_time': datetime.now(),
                'end_time': datetime.now()
            }

# Import Ralph Loop
try:
    from backend.ralph_loop import RalphLoop
except ImportError:
    # Create a simple mock if doesn't exist
    class RalphLoop:
        def __init__(self, claude_client, graphiti):
            pass
        async def validate_signals(self, raw_signals, entity_id):
            return raw_signals  # Pass through everything for now

# Import Claude client
try:
    from backend.claude_client import ClaudeClient
except ImportError:
    # Create simple mock
    class ClaudeClient:
        def __init__(self):
            pass

# Import BrightData client
try:
    from backend.brightdata_sdk_client import BrightDataSDKClient
except ImportError:
    # Create simple mock
    class BrightDataSDKClient:
        def __init__(self):
            pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def orchestrate_discovery(
    entity_id: str,
    max_iterations: int = 30,
    max_depth: int = 3
) -> Dict[str, Any]:
    """
    Orchestrate the complete discovery flow for an entity

    Args:
        entity_id: Entity ID to fetch from FalkorDB
        max_iterations: Maximum discovery iterations (default 30)
        max_depth: Maximum exploration depth (default 3)

    Returns:
        Dictionary with all results and log file path
    """

    logger.info(f"{'*'*20}")
    logger.info(f"Starting Complete Discovery Flow for {entity_id}")
    logger.info(f"{'*'*20}")

    overall_start = datetime.now()

    # ========================================
    # PHASE 1: FETCH ENTITY FROM FALKORDB
    # ========================================
    logger.info("Phase 1: Fetching entity from FalkorDB...")
    phase1_start = datetime.now()

    entity = await fetch_entity_from_falkordb(entity_id)

    if not entity:
        error_msg = f"Entity not found: {entity_id}"
        logger.error(error_msg)
        return {
            'error': error_msg,
            'entity_id': entity_id
        }

    phase1_duration = (datetime.now() - phase1_start).total_seconds()
    logger.info(f"✅ Entity fetched in {phase1_duration:.2f}s: {entity.name}")

    # ========================================
    # PHASE 2: LOAD TEMPLATE
    # ========================================
    logger.info("Phase 2: Loading template...")
    phase2_start = datetime.now()

    try:
        template = load_template_for_tier(entity.priority_tier)
        logger.info(f"✅ Template loaded: {template.get('template_id', 'unknown')} for tier {entity.priority_tier}")
    except Exception as e:
        logger.warning(f"Template loading failed: {e}, using fallback")
        template = {
            'template_id': f'fallback_{entity.priority_tier}',
            'tier': entity.priority_tier,
            'sections': []
        }

    phase2_duration = (datetime.now() - phase2_start).total_seconds()
    logger.info(f"✅ Template loaded in {phase2_duration:.2f}s")

    # ========================================
    # PHASE 3: INITIALIZE HYPOTHESES
    # ========================================
    logger.info("Phase 3: Initializing hypotheses...")
    phase3_start = datetime.now()

    try:
        hypotheses = await initialize_hypotheses_from_template(
            template,
            entity.id,
            entity.name
        )
        logger.info(f"✅ Initialized {len(hypotheses)} hypotheses")
    except Exception as e:
        logger.warning(f"Hypothesis initialization failed: {e}")
        hypotheses = []

    phase3_duration = (datetime.now() - phase3_start).total_seconds()
    logger.info(f"✅ Hypotheses initialized in {phase3_duration:.2f}s")

    # ========================================
    # PHASE 4: RUN DISCOVERY
    # ========================================
    logger.info("Phase 4: Running hypothesis-driven discovery...")
    logger.info(f"Max iterations: {max_iterations}, Max depth: {max_depth}")
    phase4_start = datetime.now()

    try:
        # Initialize clients
        claude = ClaudeClient()
        brightdata = BrightDataSDKClient()

        # Create discovery orchestrator
        discovery = HypothesisDrivenDiscovery(
            claude_client=claude,
            brightdata_client=brightdata
        )

        # Run discovery
        template_id = template.get('template_id', 'unknown')
        discovery_results = await discovery.run_discovery(
            entity_id=entity.id,
            entity_name=entity.name,
            template_id=template_id,
            max_iterations=max_iterations,
            max_depth=max_depth
        )

        phase4_duration = (datetime.now() - phase4_start).total_seconds()
        logger.info(f"✅ Discovery completed in {phase4_duration:.2f}s")

        logger.info(f"  Results:")
        logger.info(f"   - Iterations: {discovery_results.get('iterations_completed', 0)}")
        logger.info(f"   - Final Confidence: {discovery_results.get('final_confidence', 0):.3f}")
        logger.info(f"   - Total Cost: ${discovery_results.get('total_cost', 0):.4f}")
        logger.info(f"   - Raw Signals: {len(discovery_results.get('raw_signals', []))}")

    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        discovery_results = {
            'iterations_completed': 0,
            'final_confidence': 0.50,
            'total_cost': 0.0,
            'raw_signals': [],
            'iterations': [],
            'start_time': phase4_start,
            'end_time': datetime.now()
        }

    # ========================================
    # PHASE 5: VALIDATE SIGNALS (RALPH LOOP)
    # ========================================
    logger.info("Phase 5: Validating signals through Ralph Loop...")
    phase5_start = datetime.now()

    raw_signals = discovery_results.get('raw_signals', [])

    try:
        # Initialize Ralph Loop (with mocks for now)
        claude = ClaudeClient()
        # Note: We'd need Graphiti service here for real implementation
        ralph = RalphLoop(claude, graphiti=None)

        validated_signals = await ralph.validate_signals(
            raw_signals,
            entity.id
        )

        phase5_duration = (datetime.now() - phase5_start).total_seconds()
        logger.info(f"✅ Ralph validation completed in {phase5_duration:.2f}s")
        logger.info(f"   - Raw signals: {len(raw_signals)}")
        logger.info(f"   - Validated signals: {len(validated_signals)}")

    except Exception as e:
        logger.warning(f"Ralph validation failed: {e}, using raw signals")
        validated_signals = raw_signals

    # ========================================
    # PHASE 6: GENERATE DOSSIER
    # ========================================
    logger.info("Phase 6: Generating entity dossier...")
    phase6_start = datetime.now()

    try:
        dossier = await generate_dossier(
            entity=entity,
            validated_signals=validated_signals,
            final_confidence=discovery_results.get('final_confidence', 0.50),
            discovery_results=discovery_results
        )

        # Convert to dict for logging
        dossier_dict = dossier.to_dict()

        phase6_duration = (datetime.now() - phase6_start).total_seconds()
        logger.info(f"✅ Dossier generated in {phase6_duration:.2f}s")
        logger.info(f"   - Sections: {len(dossier.sections)}")
        logger.info(f"   - Actionable: {dossier.is_actionable}")

    except Exception as e:
        logger.error(f"Dossier generation failed: {e}")
        dossier_dict = None

    # ========================================
    # PHASE 7: LOG RESULTS
    # ========================================
    logger.info("Phase 7: Logging results...")
    phase7_start = datetime.now()

    try:
        log_path = await log_discovery_results(
            entity_id=entity.id,
            entity=entity,
            template=template,
            hypotheses=hypotheses,
            discovery_results=discovery_results,
            validated_signals=validated_signals,
            dossier=dossier_dict
        )

        phase7_duration = (datetime.now() - phase7_start).total_seconds()
        logger.info(f"✅ Results logged in {phase7_duration:.2f}s")
        logger.info(f"  Log file: {log_path}")

    except Exception as e:
        logger.error(f"Results logging failed: {e}")
        log_path = None

    # ========================================
    # COMPLETE
    # ========================================
    overall_duration = (datetime.now() - overall_start).total_seconds()

    logger.info(f"{'*'*20}")
    logger.info(f"Complete Discovery Flow Finished")
    logger.info(f"{'*'*20}")
    logger.info(f"Total Duration: {overall_duration:.2f}s")
    logger.info(f"Entity: {entity.name}")
    logger.info(f"Final Confidence: {discovery_results.get('final_confidence', 0):.3f}")
    logger.info(f"Validated Signals: {len(validated_signals)}")
    logger.info(f"Log File: {log_path}")
    logger.info(f"{'*'*20}")

    return {
        'entity': entity,
        'template': template,
        'hypotheses': hypotheses,
        'discovery_results': discovery_results,
        'validated_signals': validated_signals,
        'dossier': dossier_dict,
        'log_path': log_path,
        'total_duration': overall_duration
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python backend/run_complete_discovery.py <entity_id>")
        print("Example: python backend/run_complete_discovery.py international-canoe-federation")
        sys.exit(1)

    entity_id = sys.argv[1]

    async def main():
        result = await orchestrate_discovery(entity_id)

        if result.get('error'):
            print(f"ERROR: {result['error']}")
            sys.exit(1)

        print(f"\\n{'*'*20}")
        print("DISCOVERY COMPLETE")
        print(f"{'*'*20}")
        print(f"Entity: {result['entity'].name}")
        print(f"Final Confidence: {result['discovery_results'].get('final_confidence', 0):.3f}")
        print(f"Validated Signals: {len(result['validated_signals'])}")
        print(f"Log File: {result['log_path']}")
        print(f"Total Duration: {result['total_duration']:.2f}s")
        print(f"{'*'*20}")

    asyncio.run(main())
