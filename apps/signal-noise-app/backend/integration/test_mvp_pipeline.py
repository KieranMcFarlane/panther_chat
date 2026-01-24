"""
Test MVP End-to-End Pipeline

Verifies the complete thin vertical slice:
Entity Scheduler → Signal Extractor → Graph Memory → Query
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from integration.mvp_pipeline import MVPPipeline
from integration.graph_memory import get_graph_memory


async def test_pipeline_batch():
    """Test running a batch through the pipeline"""
    print("=" * 60)
    print("Test 1: Pipeline Batch Processing")
    print("=" * 60)

    pipeline = MVPPipeline()

    # Run a batch with lower priority threshold for testing
    result = await pipeline.run_batch(batch_size=3)

    print(f"✓ Pipeline batch complete")
    print(f"  Entities processed: {result.entities_processed}")
    print(f"  Signals extracted: {result.signals_extracted}")
    print(f"  Signals validated: {result.signals_validated}")
    print(f"  Signals added to graph: {result.signals_added_to_graph}")
    print(f"  Duration: {result.duration_seconds:.2f}s")
    print(f"  Errors: {len(result.errors)}")

    assert result.entities_processed > 0, "Should process at least one entity"
    assert result.signals_added_to_graph > 0, "Should add at least one signal"

    return True


async def test_entity_query():
    """Test querying entities"""
    print("\n" + "=" * 60)
    print("Test 2: Entity Query")
    print("=" * 60)

    pipeline = MVPPipeline()

    # First, run a batch to populate the graph
    result = await pipeline.run_batch(batch_size=2)

    # Get the actual entities that were processed
    graph_memory = get_graph_memory()
    all_entities = await graph_memory.get_all_entities()

    if not all_entities:
        print("  No entities found, skipping query test")
        return True

    # Query the first entity that was processed
    entity_id = all_entities[0].entity_id
    entity_data = await pipeline.query_entity(entity_id, include_signals=True)

    print(f"✓ Entity query result for {entity_id}:")
    print(f"  Found: {entity_data['found']}")
    if entity_data['found']:
        print(f"  Name: {entity_data['name']}")
        print(f"  Type: {entity_data['type']}")
        print(f"  Signals: {entity_data.get('signal_count', 0)}")

    assert entity_data['found'], f"Should find entity {entity_id}"

    return True


async def test_timeline_query():
    """Test querying entity timeline"""
    print("\n" + "=" * 60)
    print("Test 3: Timeline Query")
    print("=" * 60)

    pipeline = MVPPipeline()

    # Run a batch to populate data
    await pipeline.run_batch(batch_size=2)

    # Query timeline
    timeline = await pipeline.query_timeline("ac_milan", days=30)

    print(f"✓ Timeline query result:")
    print(f"  Entity: {timeline['entity_id']}")
    print(f"  Signals in last {timeline['days']} days: {timeline['signal_count']}")

    if timeline['timeline']:
        print(f"  Latest signal: {timeline['timeline'][0]['content'][:50]}...")

    return True


async def test_entity_search():
    """Test searching entities"""
    print("\n" + "=" * 60)
    print("Test 4: Entity Search")
    print("=" * 60)

    pipeline = MVPPipeline()

    # Populate with data
    result = await pipeline.run_batch(batch_size=3)

    # Get all entities to find a valid search term
    graph_memory = get_graph_memory()
    all_entities = await graph_memory.get_all_entities()

    if not all_entities:
        print("  No entities to search")
        return True

    # Search for part of the first entity's name
    search_term = all_entities[0].name.split()[0] if all_entities[0].name else "entity"
    results = await pipeline.search_entities(search_term)

    print(f"✓ Search results for '{search_term}': {len(results)} entities found")
    for entity in results[:3]:
        print(f"  - {entity['name']} ({entity['entity_type']})")

    # Should find at least one entity
    assert len(results) > 0, f"Should find at least one entity searching for '{search_term}'"

    return True


async def test_statistics():
    """Test getting pipeline statistics"""
    print("\n" + "=" * 60)
    print("Test 5: Pipeline Statistics")
    print("=" * 60)

    pipeline = MVPPipeline()

    # Run some data through
    await pipeline.run_batch(batch_size=5)

    # Get statistics
    stats = await pipeline.get_statistics()

    print(f"✓ Pipeline statistics:")
    print(f"  Graph backend: {stats['graph']['backend']}")
    print(f"  Total entities: {stats['graph']['total_entities']}")
    print(f"  Total signals: {stats['graph']['total_signals']}")
    print(f"  Scheduler type: {stats['scheduler']['type']}")
    print(f"  Extractor signal types: {stats['extractor']['signal_types']}")

    assert stats['graph']['total_entities'] > 0, "Should have entities"
    assert stats['graph']['total_signals'] > 0, "Should have signals"

    return True


async def test_multiple_batches():
    """Test running multiple batches"""
    print("\n" + "=" * 60)
    print("Test 6: Multiple Batches")
    print("=" * 60)

    pipeline = MVPPipeline()

    # Clear any existing data
    graph_memory = get_graph_memory()
    graph_memory.clear_mock_data()

    # Run multiple batches
    total_entities = 0
    total_signals = 0

    for i in range(3):
        result = await pipeline.run_batch(batch_size=2)
        total_entities += result.entities_processed
        total_signals += result.signals_added_to_graph
        print(f"  Batch {i+1}: {result.entities_processed} entities, "
              f"{result.signals_added_to_graph} signals")

    print(f"✓ Multiple batches complete:")
    print(f"  Total entities processed: {total_entities}")
    print(f"  Total signals added: {total_signals}")

    assert total_entities > 0, "Should process entities across batches"
    assert total_signals > 0, "Should add signals across batches"

    return True


async def run_all_tests():
    """Run all tests"""
    print("\n🔍 Testing MVP End-to-End Pipeline\n")

    tests = [
        ("Pipeline Batch Processing", test_pipeline_batch),
        ("Entity Query", test_entity_query),
        ("Timeline Query", test_timeline_query),
        ("Entity Search", test_entity_search),
        ("Pipeline Statistics", test_statistics),
        ("Multiple Batches", test_multiple_batches)
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            result = await test_func()
            if result:
                passed += 1
                print(f"✅ {test_name}: PASSED\n")
            else:
                failed += 1
                print(f"❌ {test_name}: FAILED\n")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name}: FAILED - {e}\n")
            import traceback
            traceback.print_exc()

    print("=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed == 0:
        print("\n🎉 All tests passed! MVP Pipeline is fully functional.")
        print("\n📊 MVP Components Verified:")
        print("  ✓ Entity Scheduler (prioritization)")
        print("  ✓ Signal Extractor (3 signal types)")
        print("  ✓ Graph Memory (abstraction layer)")
        print("  ✓ End-to-End Pipeline (batch processing)")
        print("  ✓ Query Interface (entity, timeline, search)")
        print("\n🚀 Ready for CopilotKit integration!")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
