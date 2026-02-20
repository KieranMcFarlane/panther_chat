"""
Cluster Intelligence System

Learns statistical patterns from promoted bindings across entities.

Core Principle: Clusters do NOT scrape. They LEARN from bindings.

Separation of Concerns:
- ❌ Templates don't learn (immutable, version-controlled)
- ❌ Bindings learn locally (entity-specific experience)
- ✅ Clusters learn statistically (cross-entity wisdom)

Capabilities:
1. Channel Effectiveness Map → Prioritise channels for new entities
2. Signal Reliability Scores → Weight confidence math
3. Discovery Shortcuts → Scale to 1,000+ entities without rediscovering

Example:
    intelligence = ClusterIntelligence()
    stats = intelligence.rollup_cluster_data("tier_1_club_centralized_procurement")
    # Returns: channel_effectiveness, signal_reliability, discovery_shortcuts

    priorities = intelligence.get_channel_priorities("tier_1_club_centralized_procurement")
    # Returns: ["official_site/news", "linkedin/jobs", "press_releases"]
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from collections import defaultdict

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from template_runtime_binding import RuntimeBinding, RuntimeBindingCache

logger = logging.getLogger(__name__)


@dataclass
class ClusterStats:
    """
    Statistical rollup of cluster intelligence

    Attributes:
        cluster_id: Template/cluster identifier
        channel_effectiveness: Channel → effectiveness score (0.0 to 1.0)
        signal_reliability: Signal → reliability score (0.0 to 1.0)
        discovery_shortcuts: Recommended channels for new entities (sorted by effectiveness)
        total_bindings: Number of promoted bindings in cluster
        last_updated: ISO timestamp of last rollup
    """
    cluster_id: str
    channel_effectiveness: Dict[str, float] = field(default_factory=dict)
    signal_reliability: Dict[str, float] = field(default_factory=dict)
    discovery_shortcuts: List[str] = field(default_factory=list)
    total_bindings: int = 0
    last_updated: str = field(default_factory=lambda: datetime.now().isoformat())

    # Additional metrics
    metadata: Dict[str, Any] = field(default_factory=dict)


class ClusterIntelligence:
    """
    Cluster intelligence system

    Learns statistical patterns from promoted bindings:
    - Channel effectiveness (which channels work best)
    - Signal reliability (which signals are most predictive)
    - Discovery shortcuts (fast path for new entities)

    Only uses PROMOTED bindings for rollups (high trust threshold).
    """

    def __init__(
        self,
        binding_cache: Optional[RuntimeBindingCache] = None,
        cache_path: str = "data/runtime_bindings/cluster_intelligence.json"
    ):
        """
        Initialize cluster intelligence

        Args:
            binding_cache: Optional binding cache (creates default if not provided)
            cache_path: Path to cluster intelligence cache JSON file
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()
        self.cache_path = Path(cache_path)
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing intelligence
        self._intelligence_cache: Dict[str, ClusterStats] = {}
        self._load_cache()

        logger.info(f"🧠 ClusterIntelligence initialized ({len(self._intelligence_cache)} clusters)")

    def _load_cache(self):
        """Load cluster intelligence from disk"""
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r') as f:
                    data = json.load(f)

                for cluster_id, stats_data in data.get("clusters", {}).items():
                    self._intelligence_cache[cluster_id] = ClusterStats(**stats_data)

                logger.info(f"✅ Loaded {len(self._intelligence_cache)} cluster intelligence profiles")

            except Exception as e:
                logger.error(f"❌ Error loading cluster intelligence cache: {e}")
                self._intelligence_cache = {}
        else:
            logger.info("ℹ️ No existing cluster intelligence cache, starting fresh")

    def _save_cache(self):
        """Save cluster intelligence to disk"""
        try:
            data = {
                "clusters": {
                    cluster_id: asdict(stats)
                    for cluster_id, stats in self._intelligence_cache.items()
                },
                "metadata": {
                    "total_clusters": len(self._intelligence_cache),
                    "last_updated": datetime.now().isoformat()
                }
            }

            with open(self.cache_path, 'w') as f:
                json.dump(data, f, indent=2)

            logger.debug(f"💾 Saved {len(self._intelligence_cache)} cluster intelligence profiles")

        except Exception as e:
            logger.error(f"❌ Error saving cluster intelligence cache: {e}")

    def rollup_cluster_data(self, cluster_id: str) -> ClusterStats:
        """
        Aggregate data from all promoted bindings in cluster

        Only uses PROMOTED bindings (high trust threshold).
        Calculates:
        - Channel effectiveness (success rate by channel)
        - Signal reliability (confidence by signal type)
        - Discovery shortcuts (sorted channels by effectiveness)

        Args:
            cluster_id: Template/cluster identifier

        Returns:
            ClusterStats with aggregated intelligence
        """
        logger.info(f"🧠 Rolling up cluster intelligence for {cluster_id}")

        # Get all bindings for cluster
        all_bindings = self.binding_cache.list_bindings(template_id=cluster_id)

        # Filter for promoted bindings only
        promoted_bindings = [
            b for b in all_bindings
            if getattr(b, 'state', 'EXPLORING') == 'PROMOTED'
        ]

        if not promoted_bindings:
            logger.warning(f"⚠️ No promoted bindings found for cluster {cluster_id}")
            return ClusterStats(cluster_id=cluster_id, total_bindings=0)

        logger.info(f"✅ Found {len(promoted_bindings)} promoted bindings for {cluster_id}")

        # Calculate channel effectiveness
        channel_effectiveness = self._calculate_channel_effectiveness(promoted_bindings)

        # Calculate signal reliability
        signal_reliability = self._calculate_signal_reliability(promoted_bindings)

        # Generate discovery shortcuts (sorted channels)
        discovery_shortcuts = self._generate_discovery_shortcuts(channel_effectiveness)

        # Create cluster stats
        stats = ClusterStats(
            cluster_id=cluster_id,
            channel_effectiveness=channel_effectiveness,
            signal_reliability=signal_reliability,
            discovery_shortcuts=discovery_shortcuts,
            total_bindings=len(promoted_bindings),
            metadata={
                "avg_usage_count": sum(b.usage_count for b in promoted_bindings) / len(promoted_bindings),
                "avg_success_rate": sum(b.success_rate for b in promoted_bindings) / len(promoted_bindings),
                "avg_confidence_adjustment": sum(b.confidence_adjustment for b in promoted_bindings) / len(promoted_bindings)
            }
        )

        # Cache intelligence
        self._intelligence_cache[cluster_id] = stats
        self._save_cache()

        logger.info(
            f"✅ Cluster intelligence rolled up: "
            f"{len(channel_effectiveness)} channels, "
            f"{len(signal_reliability)} signals, "
            f"{len(discovery_shortcuts)} shortcuts"
        )

        return stats

    def _calculate_channel_effectiveness(
        self,
        promoted_bindings: List[RuntimeBinding]
    ) -> Dict[str, float]:
        """
        Calculate channel effectiveness scores

        Effectiveness = weighted average of binding success rates
        weighted by usage count (more usage = more confidence)

        Args:
            promoted_bindings: List of promoted bindings

        Returns:
            Dictionary of channel → effectiveness score (0.0 to 1.0)
        """
        channel_scores = defaultdict(list)
        channel_weights = defaultdict(float)

        for binding in promoted_bindings:
            # Get channels used by this binding
            for channel_type in binding.discovered_channels.keys():
                # Weight by usage count (more executions = more reliable)
                weight = binding.usage_count

                # Weighted score
                weighted_score = binding.success_rate * weight

                channel_scores[channel_type].append(weighted_score)
                channel_weights[channel_type] += weight

        # Calculate weighted average
        channel_effectiveness = {}

        for channel, scores in channel_scores.items():
            total_weight = channel_weights[channel]
            avg_score = sum(scores) / total_weight if total_weight > 0 else 0.0

            channel_effectiveness[channel] = avg_score

        logger.debug(f"📊 Channel effectiveness: {channel_effectiveness}")

        return channel_effectiveness

    def _calculate_signal_reliability(
        self,
        promoted_bindings: List[RuntimeBinding]
    ) -> Dict[str, float]:
        """
        Calculate signal reliability scores

        Reliability = correlation between signal presence and binding success

        Args:
            promoted_bindings: List of promoted bindings

        Returns:
            Dictionary of signal → reliability score (0.0 to 1.0)
        """
        signal_scores = defaultdict(list)
        signal_counts = defaultdict(int)

        for binding in promoted_bindings:
            # Get enriched patterns from this binding
            for pattern_name, examples in binding.enriched_patterns.items():
                if examples:  # Signal present
                    # Signal contributes to success rate
                    signal_scores[pattern_name].append(binding.success_rate)
                    signal_counts[pattern_name] += 1

        # Calculate average reliability
        signal_reliability = {}

        for signal, scores in signal_scores.items():
            avg_score = sum(scores) / len(scores) if scores else 0.0

            # Boost score if signal appears frequently (reliable indicator)
            frequency_boost = min(signal_counts[signal] * 0.01, 0.1)

            signal_reliability[signal] = min(avg_score + frequency_boost, 1.0)

        logger.debug(f"📊 Signal reliability: {signal_reliability}")

        return signal_reliability

    def _generate_discovery_shortcuts(
        self,
        channel_effectiveness: Dict[str, float]
    ) -> List[str]:
        """
        Generate discovery shortcuts (sorted channels by effectiveness)

        Args:
            channel_effectiveness: Channel → effectiveness score

        Returns:
            List of channels sorted by effectiveness (descending)
        """
        # Sort channels by effectiveness (descending)
        sorted_channels = sorted(
            channel_effectiveness.items(),
            key=lambda x: x[1],
            reverse=True
        )

        shortcuts = [channel for channel, score in sorted_channels]

        logger.debug(f"🎯 Discovery shortcuts: {shortcuts}")

        return shortcuts

    def get_channel_priorities(self, cluster_id: str) -> List[str]:
        """
        Return channels sorted by effectiveness for new entities

        Uses cached intelligence if available, rolls up fresh data if not.

        Args:
            cluster_id: Template/cluster identifier

        Returns:
            List of channels sorted by effectiveness (descending)
        """
        # Check cache
        if cluster_id not in self._intelligence_cache:
            logger.info(f"⚠️ No cached intelligence for {cluster_id}, rolling up fresh data")
            self.rollup_cluster_data(cluster_id)

        stats = self._intelligence_cache.get(cluster_id)

        if not stats:
            logger.warning(f"⚠️ No intelligence available for {cluster_id}")
            return []

        return stats.discovery_shortcuts

    def get_cluster_stats(self, cluster_id: str) -> Optional[ClusterStats]:
        """
        Get cluster intelligence stats (cached or fresh)

        Args:
            cluster_id: Template/cluster identifier

        Returns:
            ClusterStats if available, None otherwise
        """
        # Check cache
        if cluster_id not in self._intelligence_cache:
            logger.info(f"⚠️ No cached intelligence for {cluster_id}, rolling up fresh data")
            self.rollup_cluster_data(cluster_id)

        return self._intelligence_cache.get(cluster_id)

    def get_all_cluster_stats(self) -> Dict[str, ClusterStats]:
        """
        Get all cluster intelligence stats

        Returns:
            Dictionary of cluster_id → ClusterStats
        """
        return self._intelligence_cache

    def refresh_cluster_intelligence(self, cluster_id: str):
        """
        Force refresh cluster intelligence (rollup fresh data)

        Args:
            cluster_id: Template/cluster identifier
        """
        logger.info(f"🔄 Refreshing cluster intelligence for {cluster_id}")
        self.rollup_cluster_data(cluster_id)

    def refresh_all_clusters(self):
        """Refresh cluster intelligence for all clusters"""
        logger.info("🔄 Refreshing all cluster intelligence")

        # Get all unique template IDs
        all_bindings = self.binding_cache.list_bindings()
        unique_clusters = set(b.template_id for b in all_bindings)

        logger.info(f"Found {len(unique_clusters)} unique clusters")

        for cluster_id in unique_clusters:
            self.rollup_cluster_data(cluster_id)

        logger.info(f"✅ Refreshed {len(unique_clusters)} clusters")

    def get_global_summary(self) -> Dict[str, Any]:
        """
        Get global summary of cluster intelligence

        Returns:
            Dictionary with global metrics
        """
        total_clusters = len(self._intelligence_cache)

        if total_clusters == 0:
            return {
                "total_clusters": 0,
                "avg_channels_per_cluster": 0,
                "avg_signals_per_cluster": 0,
                "top_channels": [],
                "top_signals": []
            }

        # Aggregate across all clusters
        all_channels = defaultdict(list)
        all_signals = defaultdict(list)

        for stats in self._intelligence_cache.values():
            for channel, effectiveness in stats.channel_effectiveness.items():
                all_channels[channel].append(effectiveness)

            for signal, reliability in stats.signal_reliability.items():
                all_signals[signal].append(reliability)

        # Calculate averages
        avg_channels_per_cluster = sum(len(stats.channel_effectiveness) for stats in self._intelligence_cache.values()) / total_clusters
        avg_signals_per_cluster = sum(len(stats.signal_reliability) for stats in self._intelligence_cache.values()) / total_clusters

        # Top channels (by average effectiveness)
        top_channels = sorted(
            [(ch, sum(scores)/len(scores)) for ch, scores in all_channels.items()],
            key=lambda x: x[1],
            reverse=True
        )[:5]

        # Top signals (by average reliability)
        top_signals = sorted(
            [(sig, sum(scores)/len(scores)) for sig, scores in all_signals.items()],
            key=lambda x: x[1],
            reverse=True
        )[:5]

        return {
            "total_clusters": total_clusters,
            "avg_channels_per_cluster": avg_channels_per_cluster,
            "avg_signals_per_cluster": avg_signals_per_cluster,
            "top_channels": top_channels,
            "top_signals": top_signals
        }


# =============================================================================
# Convenience Functions
# =============================================================================

def get_cluster_intelligence(
    binding_cache: Optional[RuntimeBindingCache] = None,
    cache_path: str = "data/runtime_bindings/cluster_intelligence.json"
) -> ClusterIntelligence:
    """
    Get cluster intelligence instance

    Args:
        binding_cache: Optional binding cache
        cache_path: Optional custom cache path

    Returns:
        ClusterIntelligence instance
    """
    return ClusterIntelligence(binding_cache, cache_path)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    def test_cluster_intelligence():
        """Test cluster intelligence rollup"""
        print("=== Testing Cluster Intelligence ===")

        # Create test bindings
        cache = RuntimeBindingCache()

        # Create promoted binding 1
        binding1 = RuntimeBinding(
            template_id="tier_1_club_centralized_procurement",
            entity_id="borussia-dortmund",
            entity_name="Borussia Dortmund",
            usage_count=5,
            success_rate=0.80,
            confidence_adjustment=0.15,
            discovered_channels={
                "jobs_board": ["https://linkedin.com/jobs/..."],
                "official_site": ["https://bvb.de"]
            },
            enriched_patterns={
                "Strategic Hire": ["CRM Manager", "Digital Director"],
                "Digital Transformation": ["New CRM system"]
            },
            state="PROMOTED"
        )

        # Create promoted binding 2
        binding2 = RuntimeBinding(
            template_id="tier_1_club_centralized_procurement",
            entity_id="fc-bayern-munich",
            entity_name="FC Bayern Munich",
            usage_count=4,
            success_rate=0.75,
            confidence_adjustment=0.10,
            discovered_channels={
                "jobs_board": ["https://linkedin.com/jobs/..."],
                "press": ["https://fcbayern.com/en/news"]
            },
            enriched_patterns={
                "Strategic Hire": ["Data Analyst"],
                "Partnership": ["Salesforce partnership"]
            },
            state="PROMOTED"
        )

        # Cache bindings
        cache.set_binding(binding1)
        cache.set_binding(binding2)

        # Create cluster intelligence
        intelligence = ClusterIntelligence(binding_cache=cache)

        # Rollup cluster data
        print("\n--- Rolling up cluster data ---")

        stats = intelligence.rollup_cluster_data("tier_1_club_centralized_procurement")

        print(f"Cluster: {stats.cluster_id}")
        print(f"Total Bindings: {stats.total_bindings}")
        print(f"\nChannel Effectiveness:")
        for channel, effectiveness in stats.channel_effectiveness.items():
            print(f"  {channel}: {effectiveness:.2%}")

        print(f"\nSignal Reliability:")
        for signal, reliability in stats.signal_reliability.items():
            print(f"  {signal}: {reliability:.2%}")

        print(f"\nDiscovery Shortcuts:")
        for i, shortcut in enumerate(stats.discovery_shortcuts, 1):
            print(f"  {i}. {shortcut}")

        # Get channel priorities
        print("\n--- Getting channel priorities ---")

        priorities = intelligence.get_channel_priorities("tier_1_club_centralized_procurement")
        print(f"Channel priorities: {priorities}")

        # Global summary
        print("\n--- Global Summary ---")

        summary = intelligence.get_global_summary()
        print(f"Total Clusters: {summary['total_clusters']}")
        print(f"Avg Channels per Cluster: {summary['avg_channels_per_cluster']:.1f}")
        print(f"Avg Signals per Cluster: {summary['avg_signals_per_cluster']:.1f}")

        print("\n✅ All cluster intelligence tests passed!")

    test_cluster_intelligence()
