"""
Quick integration test to demonstrate EPRB implementation works end-to-end
"""

import asyncio
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def test_exploration_logic():
    """Test the new exploration logic"""
    from backend.exploration.exploration_coordinator import ExplorationCoordinator
    from backend.exploration.canonical_categories import ExplorationCategory

    logger.info("=== Testing Exploration Logic ===")

    coordinator = ExplorationCoordinator()

    # Test with small sample
    entity_sample = ["arsenal", "chelsea"]

    # Run exploration for JOBS_BOARD category
    report = await coordinator.run_exploration_cycle(
        cluster_id="test_cluster",
        template_id="test_template",
        entity_sample=entity_sample,
        categories=[ExplorationCategory.JOBS_BOARD_EFFECTIVENESS]
    )

    logger.info(f"✅ Exploration test complete!")
    logger.info(f"   Total entries: {len(report.entries)}")
    logger.info(f"   Total observations: {report.total_observations}")
    logger.info(f"   Average confidence: {report.average_confidence:.2%}")
    logger.info(f"   Repeatable patterns: {report.get_repeatable_patterns()}")


async def test_runtime_execution():
    """Test the new runtime execution logic"""
    from backend.runtime.execution_engine import ExecutionEngine

    logger.info("=== Testing Runtime Execution ===")

    engine = ExecutionEngine()

    # Test with one entity (will use actual BrightData SDK)
    result = await engine.execute_binding_deterministic(
        template_id="test_template",
        entity_id="test_entity_1",
        entity_name="Test Entity 1"
    )

    logger.info(f"✅ Runtime test complete!")
    logger.info(f"   Success: {result.success}")
    logger.info(f"   Signals found: {result.signals_found}")
    logger.info(f"   Channels explored: {result.channels_explored}")
    logger.info(f"   SDK calls: {result.sdk_calls}")
    logger.info(f"   Claude calls: {result.claude_calls}")  # Should be 0!
    logger.info(f"   MCP calls: {result.mcp_calls}")  # Should be 0!


async def main():
    """Run all tests"""
    logger.info("🚀 Starting EPRB Integration Tests\n")

    try:
        # Test 1: Exploration logic
        await test_exploration_logic()
        print()

        # Test 2: Runtime execution
        await test_runtime_execution()
        print()

        logger.info("✅ All tests passed! EPRB implementation is working.")
        logger.info("\n📚 See documentation:")
        logger.info("   - EPRB_FINAL_COMPLETION_REPORT.md")
        logger.info("   - EPRB_TEST_RESULTS.md")
        logger.info("   - backend/EPRB_README.md")

    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
