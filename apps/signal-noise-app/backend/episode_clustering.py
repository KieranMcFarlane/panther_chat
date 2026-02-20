#!/usr/bin/env python3
"""
Episode Clustering Service

Implements semantic + temporal episode compression with embedding generation.
Combines semantically similar episodes within time windows to reduce noise
and improve temporal intelligence signals.

Features:
- Semantic embedding generation using sentence-transformers
- Temporal compression (45-day window)
- Cosine similarity clustering (0.78 threshold)
- Episode consolidation

Usage:
    from backend.episode_clustering import EpisodeClusteringService

    service = EpisodeClusteringService()
    await service.initialize()

    # Cluster episodes for an entity
    clusters = await service.cluster_entity_episodes(
        entity_id="arsenal-fc",
        time_window_days=45,
        similarity_threshold=0.78
    )
"""

import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import numpy as np

# Try to import sentence-transformers for embeddings
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("⚠️  sentence-transformers not available - using fallback embedding")

# Try to import Supabase
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class ClusteredEpisode:
    """A compressed episode representing a cluster of similar events"""
    cluster_id: str
    entity_id: str
    entity_name: str
    episode_type: str
    descriptions: List[str]  # Original descriptions
    combined_description: str  # Consolidated description
    timestamp_earliest: str
    timestamp_latest: str
    timestamp_center: str  # Weighted center timestamp
    episode_count: int
    source_episodes: List[Dict[str, Any]]  # Original episode IDs
    confidence_score: float  # Average confidence
    embedding: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClusteringConfig:
    """Configuration for episode clustering"""
    time_window_days: int = 45  # Days to consider episodes "temporally close"
    similarity_threshold: float = 0.78  # Cosine similarity threshold
    min_cluster_size: int = 2  # Minimum episodes to form a cluster
    max_cluster_size: int = 10  # Maximum episodes in a cluster (prevents over-clustering)
    embedding_model: str = "all-MiniLM-L6-v2"  # Lightweight, fast model
    fallback_model: str = "average_word_embeddings"  # Fallback if no transformers


class EpisodeClusteringService:
    """
    Service for clustering episodes based on semantic and temporal similarity
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        config: Optional[ClusteringConfig] = None
    ):
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        self.config = config or ClusteringConfig()

        # Supabase client
        self.supabase_client = None
        if self.supabase_url and self.supabase_key and SUPABASE_AVAILABLE:
            self.supabase_client = create_client(self.supabase_url, self.supabase_key)

        # Embedding model
        self.embedding_model = None
        self.initialized = False

        logger.info(f"🔗 Initializing EpisodeClusteringService (Supabase: {bool(self.supabase_client)})")

    async def initialize(self) -> bool:
        """
        Initialize the embedding model

        Returns:
            True if initialization successful
        """
        try:
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                logger.info(f"Loading sentence-transformers model: {self.config.embedding_model}")
                self.embedding_model = SentenceTransformer(self.config.embedding_model)
                logger.info("✅ Embedding model loaded")
            else:
                logger.warning("Using fallback embedding (TF-IDF based)")

            self.initialized = True
            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize embedding model: {e}")
            # Still allow initialization with fallback
            self.initialized = True
            return True

    def _generate_embedding(self, text: str) -> np.ndarray:
        """
        Generate embedding for text

        Args:
            text: Text to embed

        Returns:
            Embedding vector as numpy array
        """
        if self.embedding_model is not None:
            # Use sentence-transformers
            embedding = self.embedding_model.encode(
                text,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            return embedding
        else:
            # Fallback: simple word average embedding
            return self._fallback_embedding(text)

    def _fallback_embedding(self, text: str) -> np.ndarray:
        """
        Fallback embedding using character n-grams and word overlap

        Creates embeddings that capture semantic similarity through:
        1. Character trigrams for partial word matching
        2. Word-level tokens
        3. Stemming-like normalization

        Args:
            text: Text to embed

        Returns:
            Embedding vector as numpy array
        """
        import re

        # Normalize text
        text = text.lower()

        # Extract character trigrams (captures partial word similarities)
        trigrams = []
        for i in range(len(text) - 2):
            trigrams.append(text[i:i+3])

        # Extract word bigrams for context
        words = text.split()
        bigrams = []
        for i in range(len(words) - 1):
            bigrams.append(f"{words[i]}_{words[i+1]}")

        # Combine features
        features = trigrams + bigrams

        # Create feature hash map (fixed size)
        dimensions = 384
        embedding = np.zeros(dimensions)

        for feature in features:
            # Hash to dimension
            idx = hash(feature) % dimensions
            embedding[idx] += 1.0

        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return embedding

    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Similarity score between 0 and 1
        """
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    async def _get_entity_episodes(
        self,
        entity_id: str,
        from_time: Optional[str] = None,
        to_time: Optional[str] = None,
        episode_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch episodes for an entity from Supabase

        Args:
            entity_id: Entity identifier
            from_time: Optional start time filter
            to_time: Optional end time filter
            episode_types: Optional episode type filter

        Returns:
            List of episodes
        """
        if not self.supabase_client:
            logger.warning("No Supabase client available")
            return []

        query = self.supabase_client.table('temporal_episodes').select('*')

        # Filter by entity
        query = query.eq('entity_id', entity_id.lower().replace(' ', '-'))

        # Filter by time range if provided
        if from_time:
            query = query.gte('timestamp', from_time)
        if to_time:
            query = query.lte('timestamp', to_time)

        # Filter by episode types if provided
        if episode_types:
            query = query.in_('episode_type', episode_types)

        result = query.execute()

        episodes = result.data if hasattr(result, 'data') else []
        logger.info(f"Fetched {len(episodes)} episodes for {entity_id}")

        return episodes

    async def cluster_entity_episodes(
        self,
        entity_id: str,
        entity_name: Optional[str] = None,
        time_window_days: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
        from_time: Optional[str] = None,
        to_time: Optional[str] = None,
        episode_types: Optional[List[str]] = None
    ) -> List[ClusteredEpisode]:
        """
        Cluster episodes for an entity based on semantic and temporal similarity

        Process:
        1. Fetch all episodes for entity
        2. Sort by timestamp
        3. Generate embeddings for each episode
        4. Group into temporal windows (45-day rolling windows)
        5. Within each window, cluster by semantic similarity
        6. Consolidate clusters into single episodes

        Args:
            entity_id: Entity identifier
            entity_name: Optional display name
            time_window_days: Temporal window in days (default: 45)
            similarity_threshold: Cosine similarity threshold (default: 0.78)
            from_time: Optional start time filter
            to_time: Optional end time filter
            episode_types: Optional episode type filter

        Returns:
            List of clustered episodes
        """
        if not self.initialized:
            await self.initialize()

        # Use config defaults if not provided
        time_window = time_window_days or self.config.time_window_days
        threshold = similarity_threshold or self.config.similarity_threshold

        logger.info(f"Clustering episodes for {entity_id} (window: {time_window}d, threshold: {threshold})")

        # Fetch episodes
        episodes = await self._get_entity_episodes(entity_id, from_time, to_time, episode_types)

        if not episodes:
            logger.info(f"No episodes found for {entity_id}")
            return []

        # Sort by timestamp
        episodes.sort(key=lambda e: e.get('timestamp', ''))

        # Generate embeddings
        for ep in episodes:
            description = ep.get('description', '')
            ep['_embedding'] = self._generate_embedding(description)

        # Cluster episodes
        clusters = self._cluster_episodes(
            episodes,
            entity_id,
            entity_name or entity_id,
            time_window,
            threshold
        )

        logger.info(f"Generated {len(clusters)} clusters from {len(episodes)} episodes")

        return clusters

    def _cluster_episodes(
        self,
        episodes: List[Dict[str, Any]],
        entity_id: str,
        entity_name: str,
        time_window_days: int,
        similarity_threshold: float
    ) -> List[ClusteredEpisode]:
        """
        Perform clustering on episodes

        Args:
            episodes: List of episodes with pre-computed embeddings
            entity_id: Entity identifier
            entity_name: Entity display name
            time_window_days: Temporal window in days
            similarity_threshold: Similarity threshold for clustering

        Returns:
            List of clustered episodes
        """
        clustered = []
        used_indices = set()

        for i, episode in enumerate(episodes):
            if i in used_indices:
                continue

            # Start a new cluster with this episode
            cluster_episodes = [episode]
            used_indices.add(i)

            # Get timestamp for temporal window
            episode_time = self._parse_timestamp(episode.get('timestamp'))

            # Look for similar episodes within temporal window
            for j, other_episode in enumerate(episodes):
                if j <= i or j in used_indices:
                    continue

                # Check temporal proximity
                other_time = self._parse_timestamp(other_episode.get('timestamp'))
                time_diff = abs((other_time - episode_time).days)

                if time_diff > time_window_days:
                    continue

                # Check semantic similarity
                similarity = self._cosine_similarity(
                    episode['_embedding'],
                    other_episode['_embedding']
                )

                if similarity >= similarity_threshold:
                    cluster_episodes.append(other_episode)
                    used_indices.add(j)

                    # Stop if cluster gets too large
                    if len(cluster_episodes) >= self.config.max_cluster_size:
                        break

            # Create clustered episode if we have multiple episodes
            if len(cluster_episodes) >= self.config.min_cluster_size:
                clustered_ep = self._create_clustered_episode(
                    cluster_episodes,
                    entity_id,
                    entity_name
                )
                clustered.append(clustered_ep)
            elif len(cluster_episodes) == 1:
                # Single episode - keep as-is but mark as unclustered
                clustered_ep = self._create_clustered_episode(
                    cluster_episodes,
                    entity_id,
                    entity_name
                )
                clustered.append(clustered_ep)

        return clustered

    def _create_clustered_episode(
        self,
        episodes: List[Dict[str, Any]],
        entity_id: str,
        entity_name: str
    ) -> ClusteredEpisode:
        """
        Create a clustered episode from a list of similar episodes

        Args:
            episodes: List of episodes to cluster
            entity_id: Entity identifier
            entity_name: Entity display name

        Returns:
            ClusteredEpisode
        """
        episode_type = episodes[0].get('episode_type', 'OTHER')
        descriptions = [ep.get('description', '') for ep in episodes]
        timestamps = [self._parse_timestamp(ep.get('timestamp')) for ep in episodes]

        # Calculate weighted center timestamp (by confidence if available)
        confidences = [ep.get('confidence_score', 0.5) for ep in episodes]
        total_confidence = sum(confidences)

        if total_confidence > 0:
            # Weighted average timestamp
            weighted_timestamp = sum(
                ts.timestamp() * conf for ts, conf in zip(timestamps, confidences)
            ) / total_confidence
            center_timestamp = datetime.fromtimestamp(weighted_timestamp, tz=timezone.utc)
        else:
            # Simple average
            center_timestamp = timestamps[len(timestamps) // 2]

        # Average confidence
        avg_confidence = sum(confidences) / len(confidences)

        # Combined description
        if len(descriptions) == 1:
            combined = descriptions[0]
        else:
            # Create a consolidated description
            combined = self._consolidate_descriptions(descriptions, episode_type)

        # Generate cluster ID
        cluster_id = f"{entity_id}_{episode_type}_{int(center_timestamp.timestamp())}"

        return ClusteredEpisode(
            cluster_id=cluster_id,
            entity_id=entity_id,
            entity_name=entity_name,
            episode_type=episode_type,
            descriptions=descriptions,
            combined_description=combined,
            timestamp_earliest=min(ts.isoformat() for ts in timestamps),
            timestamp_latest=max(ts.isoformat() for ts in timestamps),
            timestamp_center=center_timestamp.isoformat(),
            episode_count=len(episodes),
            source_episodes=[ep.get('id', ep.get('episode_id', f'ep_{i}'))
                           for i, ep in enumerate(episodes)],
            confidence_score=avg_confidence,
            embedding=self._generate_embedding(combined),
            metadata={
                'clustered': len(episodes) > 1,
                'time_span_days': (max(timestamps) - min(timestamps)).days
            }
        )

    def _consolidate_descriptions(
        self,
        descriptions: List[str],
        episode_type: str
    ) -> str:
        """
        Consolidate multiple descriptions into one

        Args:
            descriptions: List of descriptions to consolidate
            episode_type: Type of episode

        Returns:
            Consolidated description
        """
        # For now, use simple pattern-based consolidation
        # Extract common patterns and count occurrences

        # Remove duplicates (exact matches)
        unique_descriptions = list(set(descriptions))

        if len(unique_descriptions) == 1:
            return unique_descriptions[0]

        # Find common prefix
        prefix = os.path.commonprefix(unique_descriptions)

        # If most of the text is common, summarize
        if len(prefix) > 30:
            # Add count
            return f"{prefix} ({len(unique_descriptions)} occurrences)"

        # Otherwise, join with separator
        return f"Multiple {episode_type.replace('_', ' ').lower()} events: {'; '.join(unique_descriptions[:3])}"

    def _parse_timestamp(self, timestamp_str: Optional[str]) -> datetime:
        """
        Parse ISO timestamp to datetime

        Args:
            timestamp_str: ISO timestamp string

        Returns:
            datetime object
        """
        if not timestamp_str:
            return datetime.now(timezone.utc)

        try:
            # Try ISO format
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            return datetime.fromisoformat(timestamp_str)
        except:
            logger.warning(f"Failed to parse timestamp: {timestamp_str}")
            return datetime.now(timezone.utc)

    async def get_cluster_timeline(
        self,
        entity_id: str,
        entity_name: Optional[str] = None,
        from_time: Optional[str] = None,
        to_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get a timeline of clustered episodes for an entity

        Returns compressed timeline with semantic clusters merged

        Args:
            entity_id: Entity identifier
            entity_name: Optional display name
            from_time: Optional start time filter
            to_time: Optional end time filter

        Returns:
            Timeline with clustered episodes
        """
        # Get all clusters
        clusters = await self.cluster_entity_episodes(
            entity_id=entity_id,
            entity_name=entity_name,
            from_time=from_time,
            to_time=to_time
        )

        # Sort by center timestamp
        clusters.sort(key=lambda c: c.timestamp_center)

        # Calculate compression stats
        total_original_episodes = sum(c.episode_count for c in clusters)
        compression_ratio = total_original_episodes / len(clusters) if clusters else 1.0

        return {
            'entity_id': entity_id,
            'entity_name': entity_name or entity_id,
            'clustered_episodes': [
                {
                    'cluster_id': c.cluster_id,
                    'episode_type': c.episode_type,
                    'description': c.combined_description,
                    'timestamp': c.timestamp_center,
                    'episode_count': c.episode_count,
                    'confidence_score': c.confidence_score,
                    'time_span_days': c.metadata.get('time_span_days', 0),
                    'was_clustered': c.metadata.get('clustered', False)
                }
                for c in clusters
            ],
            'stats': {
                'total_clusters': len(clusters),
                'total_original_episodes': total_original_episodes,
                'compression_ratio': round(compression_ratio, 2),
                'clustered_episodes': sum(1 for c in clusters if c.metadata.get('clustered', False)),
                'singleton_episodes': sum(1 for c in clusters if not c.metadata.get('clustered', False))
            },
            'generated_at': datetime.now(timezone.utc).isoformat()
        }

    async def store_clustered_episodes(
        self,
        entity_id: str,
        clusters: List[ClusteredEpisode]
    ) -> Dict[str, Any]:
        """
        Store clustered episodes in Supabase

        Creates new records in a clustered_episodes table for faster retrieval

        Args:
            entity_id: Entity identifier
            clusters: List of clustered episodes

        Returns:
            Storage result
        """
        if not self.supabase_client:
            return {'status': 'error', 'message': 'No Supabase client'}

        # Create table records
        records = []
        for cluster in clusters:
            record = {
                'cluster_id': cluster.cluster_id,
                'entity_id': cluster.entity_id,
                'entity_name': cluster.entity_name,
                'episode_type': cluster.episode_type,
                'combined_description': cluster.combined_description,
                'timestamp_center': cluster.timestamp_center,
                'timestamp_earliest': cluster.timestamp_earliest,
                'timestamp_latest': cluster.timestamp_latest,
                'episode_count': cluster.episode_count,
                'confidence_score': cluster.confidence_score,
                'source_episode_ids': cluster.source_episodes,
                'metadata': cluster.metadata,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            records.append(record)

        try:
            # Check if clustered_episodes table exists
            self.supabase_client.table('clustered_episodes').insert(records).execute()

            logger.info(f"Stored {len(records)} clustered episodes for {entity_id}")

            return {
                'status': 'success',
                'stored_count': len(records),
                'entity_id': entity_id
            }
        except Exception as e:
            logger.error(f"Failed to store clustered episodes: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }


# =============================================================================
# CLI for testing
# =============================================================================

async def main():
    """Test episode clustering"""
    import asyncio

    logging.basicConfig(level=logging.INFO)

    service = EpisodeClusteringService()
    await service.initialize()

    # Test with Arsenal FC
    entity_id = "arsenal-fc"

    result = await service.get_cluster_timeline(
        entity_id=entity_id,
        entity_name="Arsenal FC",
        from_time=(datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    )

    print("\n=== CLUSTERED TIMELINE ===")
    print(f"Entity: {result['entity_name']}")
    print(f"Total Clusters: {result['stats']['total_clusters']}")
    print(f"Original Episodes: {result['stats']['total_original_episodes']}")
    print(f"Compression Ratio: {result['stats']['compression_ratio']}x")
    print(f"Clustered: {result['stats']['clustered_episodes']}")
    print(f"Singletons: {result['stats']['singleton_episodes']}")

    print("\n=== CLUSTERS ===")
    for cluster in result['clustered_episodes']:
        cluster_type = cluster['episode_type']
        was_clustered = cluster['was_clustered']
        count = cluster['episode_count']
        desc = cluster['description'][:80] + '...' if len(cluster['description']) > 80 else cluster['description']
        timestamp = cluster['timestamp'][:10]

        icon = '🔗' if was_clustered else '•'
        print(f"{icon} {timestamp} | {cluster_type:25} | ({count} eps) {desc}")


if __name__ == "__main__":
    asyncio.run(main())
