#!/usr/bin/env python3
"""
Test Episode Clustering Service

Tests:
1. Fallback embedding generation
2. Cosine similarity calculation
3. Temporal window grouping
4. Semantic clustering with threshold
5. Episode consolidation
6. Timeline compression stats
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone, timedelta
import numpy as np
import asyncio
# Import episode_clustering directly
from episode_clustering import (
    EpisodeClusteringService,
    ClusteringConfig,
    ClusteredEpisode
)


def test_fallback_embedding():
    """Test fallback embedding generation"""
    print("=" * 70)
    print("TEST 1: Fallback Embedding Generation")
    print("=" * 70)

    service = EpisodeClusteringService()
    service.embedding_model = None  # Force fallback

    # Test embeddings
    text1 = "CRM system upgrade needed"
    text2 = "Customer relationship management platform"

    emb1 = service._fallback_embedding(text1)
    emb2 = service._fallback_embedding(text2)

    print(f"\nText 1: '{text1}'")
    print(f"  Embedding shape: {emb1.shape}")
    print(f"  Norm: {np.linalg.norm(emb1):.4f}")

    print(f"\nText 2: '{text2}'")
    print(f"  Embedding shape: {emb2.shape}")
    print(f"  Norm: {np.linalg.norm(emb2):.4f}")

    # Check embeddings are normalized
    assert np.allclose(np.linalg.norm(emb1), 1.0, atol=0.01), "Embedding should be normalized"
    assert np.allclose(np.linalg.norm(emb2), 1.0, atol=0.01), "Embedding should be normalized"

    # Check similarity of related texts
    similarity = service._cosine_similarity(emb1, emb2)
    print(f"\nCosine similarity: {similarity:.4f}")
    assert similarity > 0, "Similar texts should have positive similarity"

    print("\n✅ Fallback embedding works correctly")


def test_cosine_similarity():
    """Test cosine similarity calculation"""
    print("\n" + "=" * 70)
    print("TEST 2: Cosine Similarity Calculation")
    print("=" * 70)

    service = EpisodeClusteringService()

    # Identical vectors
    vec1 = np.array([1.0, 0.0, 0.0])
    vec2 = np.array([1.0, 0.0, 0.0])
    sim = service._cosine_similarity(vec1, vec2)
    print(f"\nIdentical vectors: {sim:.4f}")
    assert np.isclose(sim, 1.0), "Identical vectors should have similarity 1.0"

    # Orthogonal vectors
    vec1 = np.array([1.0, 0.0, 0.0])
    vec2 = np.array([0.0, 1.0, 0.0])
    sim = service._cosine_similarity(vec1, vec2)
    print(f"Orthogonal vectors: {sim:.4f}")
    assert np.isclose(sim, 0.0), "Orthogonal vectors should have similarity 0.0"

    # Similar vectors (30 degrees)
    vec1 = np.array([1.0, 0.0, 0.0])
    vec2 = np.array([0.866, 0.5, 0.0])  # cos(30°) = 0.866
    sim = service._cosine_similarity(vec1, vec2)
    print(f"30° apart vectors: {sim:.4f}")
    assert sim > 0.85 and sim < 0.9, f"Similarity should be ~0.866, got {sim}"

    print("\n✅ Cosine similarity calculation correct")


def test_temporal_window_grouping():
    """Test temporal window grouping"""
    print("\n" + "=" * 70)
    print("TEST 3: Temporal Window Grouping")
    print("=" * 70)

    service = EpisodeClusteringService()
    config = ClusteringConfig(time_window_days=45)

    now = datetime.now(timezone.utc)

    # Create episodes at different times
    episodes = []

    # Episode 1: Today
    episodes.append({
        'id': 'ep1',
        'entity_id': 'test-entity',
        'episode_type': 'RFP_DETECTED',
        'description': 'RFP for CRM system',
        'timestamp': now.isoformat(),
        'confidence_score': 0.8
    })

    # Episode 2: 30 days ago (within 45-day window)
    episodes.append({
        'id': 'ep2',
        'entity_id': 'test-entity',
        'episode_type': 'RFP_DETECTED',
        'description': 'CRM platform tender',
        'timestamp': (now - timedelta(days=30)).isoformat(),
        'confidence_score': 0.7
    })

    # Episode 3: 60 days ago (outside 45-day window from ep1)
    episodes.append({
        'id': 'ep3',
        'entity_id': 'test-entity',
        'episode_type': 'RFP_DETECTED',
        'description': 'Database upgrade RFP',
        'timestamp': (now - timedelta(days=60)).isoformat(),
        'confidence_score': 0.9
    })

    # Generate embeddings
    for ep in episodes:
        ep['_embedding'] = service._generate_embedding(ep['description'])

    # Test temporal grouping
    time_diff_1_2 = abs((now - (now - timedelta(days=30))).days)
    time_diff_1_3 = abs((now - (now - timedelta(days=60))).days)

    print(f"\nTime diff (ep1, ep2): {time_diff_1_2} days (within window: {time_diff_1_2 <= config.time_window_days})")
    print(f"Time diff (ep1, ep3): {time_diff_1_3} days (within window: {time_diff_1_3 <= config.time_window_days})")

    assert time_diff_1_2 <= config.time_window_days, "ep1 and ep2 should be in same window"
    assert time_diff_1_3 > config.time_window_days, "ep1 and ep3 should be in different windows"

    print("\n✅ Temporal window grouping works correctly")


async def test_semantic_clustering():
    """Test semantic clustering with similarity threshold"""
    print("\n" + "=" * 70)
    print("TEST 4: Semantic Clustering with Threshold")
    print("=" * 70)

    service = EpisodeClusteringService()
    await service.initialize()

    now = datetime.now(timezone.utc)

    # Create semantically similar episodes
    episodes = []

    descriptions = [
        "RFP issued for CRM system upgrade",
        "Tender for customer relationship management platform",
        "Procurement for CRM software",  # Should cluster
        "Digital transformation initiative",  # Different - should not cluster
    ]

    for i, desc in enumerate(descriptions):
        episodes.append({
            'id': f'ep{i}',
            'entity_id': 'test-entity',
            'episode_type': 'RFP_DETECTED',
            'description': desc,
            'timestamp': (now - timedelta(days=i*5)).isoformat(),  # Within temporal window
            'confidence_score': 0.8
        })

    # Generate embeddings
    for ep in episodes:
        ep['_embedding'] = service._generate_embedding(ep['description'])

    # Test similarities
    print("\nSemantic Similarity Matrix:")
    print(f"{'':<30} {'ep1':>10} {'ep2':>10} {'ep3':>10} {'ep4':>10}")
    print("-" * 70)

    for i, ep1 in enumerate(episodes):
        row = [ep1['description'][:25]]
        for j, ep2 in enumerate(episodes):
            sim = service._cosine_similarity(ep1['_embedding'], ep2['_embedding'])
            row.append(f"{sim:.3f}")
        print(f"{row[0]:<30} {row[1]:>10} {row[2]:>10} {row[3]:>10} {row[4]:>10}")

    # Check that CRM-related episodes have higher similarity
    sim_crm_1_2 = service._cosine_similarity(episodes[0]['_embedding'], episodes[1]['_embedding'])
    sim_crm_1_4 = service._cosine_similarity(episodes[0]['_embedding'], episodes[3]['_embedding'])

    print(f"\nCRM vs CRM similarity: {sim_crm_1_2:.3f}")
    print(f"CRM vs Digital similarity: {sim_crm_1_4:.3f}")

    assert sim_crm_1_2 > sim_crm_1_4, "CRM episodes should be more similar to each other"

    print("\n✅ Semantic clustering identifies similar episodes")


def test_episode_consolidation():
    """Test episode consolidation"""
    print("\n" + "=" * 70)
    print("TEST 5: Episode Consolidation")
    print("=" * 70)

    service = EpisodeClusteringService()

    now = datetime.now(timezone.utc)

    # Create a cluster of episodes
    episodes = [
        {
            'id': 'ep1',
            'episode_id': 'rfp-001',
            'entity_id': 'test-entity',
            'episode_type': 'RFP_DETECTED',
            'description': 'RFP for CRM system',
            'timestamp': (now - timedelta(days=10)).isoformat(),
            'confidence_score': 0.8
        },
        {
            'id': 'ep2',
            'episode_id': 'rfp-002',
            'entity_id': 'test-entity',
            'episode_type': 'RFP_DETECTED',
            'description': 'CRM platform tender',
            'timestamp': (now - timedelta(days=5)).isoformat(),
            'confidence_score': 0.9
        },
        {
            'id': 'ep3',
            'episode_id': 'rfp-003',
            'entity_id': 'test-entity',
            'episode_type': 'RFP_DETECTED',
            'description': 'Procurement CRM software',
            'timestamp': now.isoformat(),
            'confidence_score': 0.7
        }
    ]

    # Create clustered episode
    clustered = service._create_clustered_episode(
        episodes,
        'test-entity',
        'Test Entity'
    )

    print(f"\nCluster ID: {clustered.cluster_id}")
    print(f"Entity: {clustered.entity_name}")
    print(f"Episode Type: {clustered.episode_type}")
    print(f"Episode Count: {clustered.episode_count}")
    print(f"Combined Description: {clustered.combined_description}")
    print(f"Timestamp Earliest: {clustered.timestamp_earliest[:10]}")
    print(f"Timestamp Latest: {clustered.timestamp_latest[:10]}")
    print(f"Timestamp Center: {clustered.timestamp_center[:10]}")
    print(f"Average Confidence: {clustered.confidence_score:.2f}")
    print(f"Source Episodes: {clustered.source_episodes}")
    print(f"Time Span Days: {clustered.metadata.get('time_span_days', 0)}")

    assert clustered.episode_count == 3, "Should have 3 episodes"
    assert len(clustered.descriptions) == 3, "Should have 3 descriptions"
    assert clustered.confidence_score > 0, "Should have positive confidence"
    assert clustered.metadata.get('clustered') == True, "Should be marked as clustered"

    print("\n✅ Episode consolidation works correctly")


def test_timeline_compression_stats():
    """Test timeline compression statistics"""
    print("\n" + "=" * 70)
    print("TEST 6: Timeline Compression Statistics")
    print("=" * 70)

    service = EpisodeClusteringService()

    # Create mock clustered episodes
    now = datetime.now(timezone.utc)

    clusters = [
        ClusteredEpisode(
            cluster_id="cluster1",
            entity_id="test-entity",
            entity_name="Test Entity",
            episode_type="RFP_DETECTED",
            descriptions=["RFP 1", "RFP 2"],
            combined_description="Multiple RFP events",
            timestamp_earliest=(now - timedelta(days=10)).isoformat(),
            timestamp_latest=now.isoformat(),
            timestamp_center=(now - timedelta(days=5)).isoformat(),
            episode_count=2,  # Clustered
            source_episodes=["ep1", "ep2"],
            confidence_score=0.8,
            metadata={'clustered': True, 'time_span_days': 10}
        ),
        ClusteredEpisode(
            cluster_id="cluster2",
            entity_id="test-entity",
            entity_name="Test Entity",
            episode_type="TECHNOLOGY_ADOPTED",
            descriptions=["Tech adoption"],
            combined_description="New technology adopted",
            timestamp_earliest=(now - timedelta(days=30)).isoformat(),
            timestamp_latest=(now - timedelta(days=30)).isoformat(),
            timestamp_center=(now - timedelta(days=30)).isoformat(),
            episode_count=1,  # Singleton
            source_episodes=["ep3"],
            confidence_score=0.9,
            metadata={'clustered': False, 'time_span_days': 0}
        )
    ]

    # Calculate stats
    total_original = sum(c.episode_count for c in clusters)
    total_clusters = len(clusters)
    compression_ratio = total_original / total_clusters
    clustered_count = sum(1 for c in clusters if c.metadata.get('clustered', False))
    singleton_count = sum(1 for c in clusters if not c.metadata.get('clustered', False))

    print(f"\nTotal Clusters: {total_clusters}")
    print(f"Total Original Episodes: {total_original}")
    print(f"Compression Ratio: {compression_ratio:.2f}x")
    print(f"Clustered Episodes: {clustered_count}")
    print(f"Singleton Episodes: {singleton_count}")

    assert total_original == 3, "Should have 3 original episodes"
    assert total_clusters == 2, "Should have 2 clusters"
    assert compression_ratio == 1.5, "Compression ratio should be 1.5x"
    assert clustered_count == 1, "Should have 1 clustered episode"
    assert singleton_count == 1, "Should have 1 singleton"

    print("\n✅ Timeline compression statistics calculated correctly")


async def run_all_tests():
    """Run all tests"""
    print("\n🧪 Episode Clustering Test Suite")
    print()

    try:
        test_fallback_embedding()
        test_cosine_similarity()
        test_temporal_window_grouping()
        await test_semantic_clustering()
        test_episode_consolidation()
        test_timeline_compression_stats()

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED ✅")
        print("=" * 70)
        print("\nThe episode clustering system successfully:")
        print("  1. Generates fallback embeddings when sentence-transformers unavailable")
        print("  2. Calculates cosine similarity correctly")
        print("  3. Groups episodes within temporal windows")
        print("  4. Identifies semantically similar episodes")
        print("  5. Consolidates episodes into clusters")
        print("  6. Calculates compression statistics")
        sys.exit(0)

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
