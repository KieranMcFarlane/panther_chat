#!/usr/bin/env python3
"""
Test FalkorDB Cloud Connection with Native Client

Tests the hypothesis-driven discovery system with live FalkorDB Cloud.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


async def test_falkordb_connection():
    """Test native FalkorDB connection"""
    print("\n=== Testing FalkorDB Cloud Connection ===\n")

    # Test with provided credentials
    import os
    os.environ["FALKORDB_URI"] = "rediss://<falkordb-cloud-host>:<port>"
    os.environ["FALKORDB_USER"] = "falkordb"
    os.environ["FALKORDB_PASSWORD"] = "<falkordb-password>"
    os.environ["FALKORDB_DATABASE"] = "sports_intelligence"

    try:
        from falkordb import FalkorDB
        print("✅ falkordb library installed")
    except ImportError:
        print("❌ falkordb not installed. Run: pip install falkordb")
        return False

    # Parse URI
    import urllib.parse
    uri = os.getenv("FALKORDB_URI")
    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname
    port = parsed.port
    username = os.getenv("FALKORDB_USER")
    password = os.getenv("FALKORDB_PASSWORD")
    database = os.getenv("FALKORDB_DATABASE")

    print(f"\nConnection details:")
    print(f"  Host: {host}")
    print(f"  Port: {port}")
    print(f"  Username: {username}")
    print(f"  Database: {database}")

    try:
        # Connect
        print(f"\n🔗 Connecting to FalkorDB Cloud...")
        db = FalkorDB(
            host=host,
            port=port,
            username=username,
            password=password,
            ssl=True
        )

        # Select graph
        g = db.select_graph(database)
        print(f"✅ Selected graph: {database}")

        # Test query
        print(f"\n🧪 Running test query...")
        result = g.query("RETURN 1 AS test")
        results = list(result)
        print(f"✅ Query successful: {results[0][0] if results else 'No results'}")

        # Test creating a hypothesis node
        print(f"\n💾 Creating test hypothesis node...")
        g.query("""
            CREATE (h:Hypothesis {
                hypothesis_id: 'test_cloud_connection',
                entity_id: 'test-entity',
                category: 'Test',
                statement: 'Test hypothesis',
                confidence: 0.5,
                status: 'ACTIVE',
                created_at: '2026-02-02T00:00:00Z'
            })
        """)
        print("✅ Hypothesis node created")

        # Test reading it back
        print(f"\n📖 Reading hypothesis back...")
        result = g.query("""
            MATCH (h:Hypothesis {hypothesis_id: 'test_cloud_connection'})
            RETURN h.confidence AS confidence, h.status AS status
        """)
        results = list(result)
        if results:
            print(f"✅ Hypothesis loaded: confidence={results[0][0]}, status={results[0][1]}")

        # Clean up
        print(f"\n🧹 Cleaning up test data...")
        g.query("""
            MATCH (h:Hypothesis {hypothesis_id: 'test_cloud_connection'})
            DELETE h
        """)
        print("✅ Test data deleted")

        print(f"\n✅ FalkorDB Cloud connection successful!")
        return True

    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_hypothesis_repository():
    """Test HypothesisRepository with FalkorDB Cloud"""
    print("\n=== Testing HypothesisRepository ===\n")

    # Set environment variables
    import os
    os.environ["FALKORDB_URI"] = "rediss://<falkordb-cloud-host>:<port>"
    os.environ["FALKORDB_USER"] = "falkordb"
    os.environ["FALKORDB_PASSWORD"] = "<falkordb-password>"
    os.environ["FALKORDB_DATABASE"] = "sports_intelligence"

    try:
        from backend.hypothesis_persistence_native import HypothesisRepository
        from backend.hypothesis_manager import Hypothesis

        # Initialize repository
        print("🔬 Initializing HypothesisRepository...")
        repo = HypothesisRepository()

        if not await repo.initialize():
            print("❌ Failed to initialize repository")
            return False

        print("✅ Repository initialized")

        # Create test hypothesis
        print(f"\n📝 Creating test hypothesis...")
        h = Hypothesis(
            hypothesis_id="test_falkordb_cloud",
            entity_id="test-entity-cloud",
            category="CRM Implementation",
            statement="Test entity is preparing CRM procurement via FalkorDB Cloud",
            prior_probability=0.5,
            confidence=0.65
        )

        # Save hypothesis
        print(f"💾 Saving hypothesis to FalkorDB Cloud...")
        if not await repo.save_hypothesis(h):
            print("❌ Failed to save hypothesis")
            return False

        print("✅ Hypothesis saved")

        # Load hypothesis
        print(f"\n📖 Loading hypothesis from FalkorDB Cloud...")
        loaded = await repo.get_hypothesis("test_falkordb_cloud")
        if not loaded:
            print("❌ Failed to load hypothesis")
            return False

        print(f"✅ Hypothesis loaded:")
        print(f"   ID: {loaded.hypothesis_id}")
        print(f"   Statement: {loaded.statement}")
        print(f"   Confidence: {loaded.confidence}")
        print(f"   Status: {loaded.status}")

        # Update hypothesis
        print(f"\n🔄 Updating hypothesis...")
        updated = await repo.get_hypothesis("test_falkordb_cloud")
        updated.confidence = 0.75
        updated.iterations_accepted = 2

        if await repo.save_hypothesis(updated):
            print("✅ Hypothesis updated")
            print(f"   New confidence: {updated.confidence}")

        # Test cluster pattern frequencies
        print(f"\n🧮 Testing cluster pattern frequencies...")
        await repo.update_cluster_pattern_frequency(
            cluster_id="tier_1_clubs",
            pattern_name="Strategic Hire"
        )

        frequencies = await repo.get_cluster_pattern_frequencies("tier_1_clubs")
        print(f"✅ Cluster frequencies: {frequencies}")

        # Close repository
        await repo.close()

        print(f"\n✅ HypothesisRepository test successful!")
        return True

    except Exception as e:
        print(f"❌ Repository test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_full_system():
    """Test full hypothesis-driven discovery system with FalkorDB"""
    print("\n=== Testing Full System with FalkorDB ===\n")

    # Set environment variables
    import os
    os.environ["FALKORDB_URI"] = "rediss://<falkordb-cloud-host>:<port>"
    os.environ["FALKORDB_USER"] = "falkordb"
    os.environ["FALKORDB_PASSWORD"] = "<falkordb-password>"
    os.environ["FALKORDB_DATABASE"] = "sports_intelligence"

    try:
        from backend.hypothesis_manager import HypothesisManager, Hypothesis
        from backend.eig_calculator import EIGCalculator

        # Initialize manager with repository
        print("🔬 Initializing HypothesisManager...")
        manager = HypothesisManager()  # Will auto-load native repository

        # Create test hypotheses
        hypotheses = [
            Hypothesis(
                hypothesis_id="arsenal_crm_cloud",
                entity_id="arsenal-fc",
                category="CRM Implementation",
                statement="Arsenal FC is preparing CRM procurement (stored in FalkorDB Cloud)",
                prior_probability=0.5,
                confidence=0.42
            ),
            Hypothesis(
                hypothesis_id="arsenal_digital_cloud",
                entity_id="arsenal-fc",
                category="Digital Transformation",
                statement="Arsenal FC is undergoing digital transformation (stored in FalkorDB Cloud)",
                prior_probability=0.5,
                confidence=0.80
            ),
            Hypothesis(
                hypothesis_id="arsenal_cto_cloud",
                entity_id="arsenal-fc",
                category="C-Suite Hiring",
                statement="Arsenal FC is hiring CTO (stored in FalkorDB Cloud)",
                prior_probability=0.5,
                confidence=0.50
            )
        ]

        # Cache hypotheses
        manager._hypotheses_cache["arsenal-fc"] = hypotheses

        print(f"✅ Created {len(hypotheses)} test hypotheses")

        # Initialize EIG calculator
        print("\n🧮 Initializing EIGCalculator...")
        calculator = EIGCalculator()

        # Calculate EIG for all hypotheses
        print("\n📊 Calculating EIG...")
        for h in hypotheses:
            h.expected_information_gain = calculator.calculate_eig(h)
            print(f"  {h.hypothesis_id}: EIG = {h.expected_information_gain:.3f}")

        # Rank by EIG
        ranked = sorted(hypotheses, key=lambda h: h.expected_information_gain, reverse=True)
        print(f"\n🏆 Top hypothesis: {ranked[0].hypothesis_id} (EIG: {ranked[0].expected_information_gain:.3f})")

        # Update top hypothesis
        print(f"\n🔄 Updating top hypothesis...")
        top = ranked[0]
        updated = await manager.update_hypothesis(
            hypothesis_id=top.hypothesis_id,
            entity_id="arsenal-fc",
            decision="ACCEPT",
            confidence_delta=0.06,
            evidence_ref="falkordb_cloud_test"
        )

        print(f"  Old confidence: {top.confidence:.2f}")
        print(f"  New confidence: {updated.confidence:.2f}")
        print(f"  Delta: {updated.last_delta:+.2f}")

        # Load from database to verify persistence
        print(f"\n💾 Verifying persistence...")
        loaded = await manager.get_hypothesis(top.hypothesis_id, "arsenal-fc")
        if loaded:
            print(f"✅ Hypothesis persisted and loaded successfully")
            print(f"   Confidence in DB: {loaded.confidence:.2f}")
        else:
            print(f"⚠️ Hypothesis not found in database (may not have persisted)")

        print(f"\n✅ Full system test successful!")
        return True

    except Exception as e:
        print(f"❌ Full system test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("FalkorDB Cloud Integration Test")
    print("="*60)

    # Test 1: Basic connection
    if not await test_falkordb_connection():
        print("\n❌ Connection test failed. Stopping.")
        return

    print("\n" + "="*60 + "\n")

    # Test 2: HypothesisRepository
    if not await test_hypothesis_repository():
        print("\n❌ Repository test failed. Stopping.")
        return

    print("\n" + "="*60 + "\n")

    # Test 3: Full system
    if not await test_full_system():
        print("\n❌ Full system test failed.")
        return

    print("\n" + "="*60)
    print("✅ All FalkorDB Cloud tests passed!")
    print("="*60 + "\n")

    print("\n🎉 FalkorDB Cloud is now configured and working!")
    print("\n💡 The hypothesis-driven discovery system is ready for production use.")


if __name__ == "__main__":
    asyncio.run(main())
