"""
Test Entity Scheduler for MVP

Verifies:
- Entity discovery
- Priority scoring
- Batch retrieval
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scheduler.entity_scheduler import EntityScheduler


async def test_entity_discovery():
    """Test entity discovery"""
    print("=" * 60)
    print("Test 1: Entity Discovery")
    print("=" * 60)

    scheduler = EntityScheduler(graphiti_service=None)
    entities = await scheduler._get_scrapeable_entities()

    print(f"✓ Discovered {len(entities)} entities")
    print(f"  Sample entities: {entities[:3]}")

    assert len(entities) > 0, "Should discover at least one entity"
    return True


async def test_priority_scoring():
    """Test priority scoring"""
    print("\n" + "=" * 60)
    print("Test 2: Priority Scoring")
    print("=" * 60)

    scheduler = EntityScheduler(graphiti_service=None)
    entity_ids = ["ac_milan", "manchester_united", "liverpool_fc"]

    priorities = await scheduler.prioritize_entities(entity_ids)

    print(f"✓ Scored {len(priorities)} entities")
    for p in priorities:
        print(f"  {p.entity_name}:")
        print(f"    - Priority: {p.priority_score:.2f}")
        print(f"    - Freshness: {p.freshness_score:.2f}")
        print(f"    - Signals: {p.scrape_count}")

    assert len(priorities) == len(entity_ids), "Should score all entities"
    assert all(p.priority_score >= 0 for p in priorities), "Scores should be non-negative"

    # Check sorting (descending by priority)
    for i in range(len(priorities) - 1):
        assert priorities[i].priority_score >= priorities[i+1].priority_score, \
            "Should be sorted by priority (descending)"

    return True


async def test_batch_retrieval():
    """Test batch retrieval"""
    print("\n" + "=" * 60)
    print("Test 3: Batch Retrieval")
    print("=" * 60)

    scheduler = EntityScheduler(graphiti_service=None)
    batch_size = 5

    batch = await scheduler.get_next_batch(batch_size=batch_size)

    print(f"✓ Retrieved batch of {len(batch)} entities (requested {batch_size})")
    print(f"  Entity IDs: {batch}")

    assert len(batch) <= batch_size, "Should not exceed batch size"
    assert len(batch) > 0, "Should return at least one entity"

    return True


async def test_freshness_filtering():
    """Test freshness filtering"""
    print("\n" + "=" * 60)
    print("Test 4: Freshness Filtering")
    print("=" * 60)

    scheduler = EntityScheduler(graphiti_service=None)

    # Test with explicitly recent timestamp (today)
    from datetime import datetime, timezone
    recent_timestamp = datetime.now(timezone.utc)
    recent = scheduler._is_recent(recent_timestamp)
    print(f"✓ Recent signal detected (today): {recent}")

    assert recent == True, "Should detect recent signals (today)"

    # Test with old timestamp (30 days ago)
    from datetime import timedelta
    old_timestamp = datetime.now(timezone.utc) - timedelta(days=30)
    old = scheduler._is_recent(old_timestamp)
    print(f"✓ Old signal rejected (30 days): {not old}")

    assert old == False, "Should reject signals older than 7 days"

    return True


async def run_all_tests():
    """Run all tests"""
    print("\n🔍 Testing Entity Scheduler (MVP)\n")

    tests = [
        ("Entity Discovery", test_entity_discovery),
        ("Priority Scoring", test_priority_scoring),
        ("Batch Retrieval", test_batch_retrieval),
        ("Freshness Filtering", test_freshness_filtering)
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
        print("\n🎉 All tests passed! Entity Scheduler is ready for MVP.")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
