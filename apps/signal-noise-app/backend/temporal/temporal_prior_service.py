"""
Temporal Prior Service - Core implementation

Computes timing likelihoods from historical episodes and serves temporal multipliers.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from backend.temporal.models import (
    SignalCategory,
    TemporalPrior,
    TemporalMultiplierResponse
)
from backend.temporal.category_mapper import CategoryMapper
from backend.temporal.seasonal_analyzer import SeasonalityAnalyzer
from backend.temporal.recurrence_analyzer import RecurrenceAnalyzer
from backend.temporal.momentum_tracker import MomentumTracker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TemporalPriorService:
    """
    Service for computing and serving temporal priors

    Nightly computation:
    - Load all episodes from Graphiti/Supabase
    - Compute priors per (entity_id, signal_category)
    - Store priors to disk: data/temporal_priors.json

    Runtime API:
    - Get temporal multiplier for entity + category
    - Apply backoff hierarchy: entity → entity-wide → cluster → global
    - Return multiplier in range [0.75, 1.40]
    """

    def __init__(self, priors_path: str = "data/temporal_priors.json"):
        """
        Initialize the service

        Args:
            priors_path: Path to store/load computed priors
        """
        self.priors_path = Path(priors_path)
        self.priors: Dict[str, TemporalPrior] = {}
        self.entity_clusters: Dict[str, str] = {}  # entity_id → cluster_id
        self._load_priors()

    # ==========================================================================
    # NIGHTLY COMPUTATION
    # ==========================================================================

    async def compute_all_priors(self, min_sample_size: int = 2):
        """
        Nightly job: Compute priors for all entities

        This is the main computation pipeline that:
        1. Loads all entities and episodes
        2. Groups episodes by (entity_id, signal_category)
        3. Computes priors for each group
        4. Applies backoff hierarchy
        5. Saves to disk

        Args:
            min_sample_size: Minimum episodes required to compute a prior
        """
        logger.info("Starting temporal prior computation...")

        try:
            # Import here to avoid circular dependencies
            from backend.graphiti_service import GraphitiService

            # Connect to Graphiti/Supabase
            graphiti = GraphitiService()
            await graphiti.initialize()

            # Load all episodes
            logger.info("Loading episodes from database...")
            all_episodes = await self._load_all_episodes(graphiti)

            logger.info(f"Loaded {len(all_episodes)} episodes")

            # Group by (entity_id, signal_category)
            grouped_episodes = self._group_episodes_by_entity_category(all_episodes)

            logger.info(f"Computed priors for {len(grouped_episodes)} entity-category pairs")

            # Compute priors for each group
            all_priors = {}

            for key, episodes in grouped_episodes.items():
                entity_id, signal_category = key

                if len(episodes) < min_sample_size:
                    continue

                try:
                    prior = self._compute_prior(entity_id, signal_category, episodes)
                    prior_key = f"{entity_id}:{signal_category.value}"
                    all_priors[prior_key] = prior

                except Exception as e:
                    logger.warning(f"Failed to compute prior for {key}: {e}")
                    continue

            # Compute aggregate priors (entity-wide, cluster-wide, global)
            logger.info("Computing aggregate priors...")
            aggregate_priors = await self._compute_aggregate_priors(
                all_priors, grouped_episodes, graphiti
            )

            # Merge
            all_priors.update(aggregate_priors)

            # Save to disk
            logger.info(f"Saving {len(all_priors)} priors to {self.priors_path}...")
            self._save_priors(all_priors)

            # Update in-memory cache
            self.priors = all_priors

            logger.info(f"✅ Computed {len(all_priors)} temporal priors")

        except Exception as e:
            logger.error(f"❌ Failed to compute priors: {e}", exc_info=True)
            raise

    async def _load_all_episodes(self, graphiti) -> List[Dict]:
        """Load all episodes from database"""
        episodes = []

        try:
            # Try Supabase first
            if hasattr(graphiti, 'supabase_client') and graphiti.supabase_client:
                response = graphiti.supabase_client.table('temporal_episodes') \
                    .select('*') \
                    .order('timestamp', desc=False) \
                    .limit(10000) \
                    .execute()

                episodes = response.data
                logger.info(f"Loaded {len(episodes)} episodes from Supabase")

            # Fallback to FalkorDB
            elif hasattr(graphiti, 'driver') and graphiti.driver:
                with graphiti.driver.session(database=graphiti.graph_name) as session:
                    result = session.run("""
                        MATCH (e)-[:HAS_EPISODE]->(ep:Episode)
                        RETURN ep
                        ORDER BY ap.timestamp ASC
                        LIMIT 10000
                    """)

                    for record in result:
                        episode_node = record['ap']
                        episodes.append(dict(episode_node))

                    logger.info(f"Loaded {len(episodes)} episodes from FalkorDB")

        except Exception as e:
            logger.error(f"Failed to load episodes: {e}")

        return episodes

    def _group_episodes_by_entity_category(
        self,
        episodes: List[Dict]
    ) -> Dict[Tuple[str, SignalCategory], List[Dict]]:
        """Group episodes by (entity_id, signal_category)"""
        grouped = defaultdict(list)

        for ep in episodes:
            entity_id = ep.get('entity_id') or ep.get('entity_name', 'unknown')
            template_name = ep.get('template_name', ep.get('description', ''))
            current_category = ep.get('category', 'Operations')

            # Map to canonical category
            signal_category = CategoryMapper.map_template_to_category(
                template_name, current_category
            )

            # Add signal_category to episode for reference
            ep['signal_category'] = signal_category.value

            key = (entity_id, signal_category)
            grouped[key].append(ep)

        return grouped

    def _compute_prior(
        self,
        entity_id: str,
        signal_category: SignalCategory,
        episodes: List[Dict]
    ) -> TemporalPrior:
        """Compute a single temporal prior"""
        # Compute components
        seasonality = SeasonalityAnalyzer.compute_seasonality(episodes)
        recurrence_mean, recurrence_std = RecurrenceAnalyzer.compute_recurrence(episodes)
        momentum = MomentumTracker.compute_momentum(episodes)

        # Get last seen timestamp
        last_seen_ts = max([
            ep.get('timestamp') or ep.get('created_at') or datetime.now().isoformat()
            for ep in episodes
        ])
        last_seen = datetime.fromisoformat(last_seen_ts.replace('Z', '+00:00'))

        return TemporalPrior(
            entity_id=entity_id,
            signal_category=signal_category,
            seasonality=seasonality,
            recurrence_mean=recurrence_mean,
            recurrence_std=recurrence_std,
            momentum_30d=momentum['30d'],
            momentum_90d=momentum['90d'],
            last_seen=last_seen,
            sample_size=len(episodes),
            computed_at=datetime.now()
        )

    async def _compute_aggregate_priors(
        self,
        entity_priors: Dict[str, TemporalPrior],
        grouped_episodes: Dict[Tuple[str, SignalCategory], List[Dict]],
        graphiti
    ) -> Dict[str, TemporalPrior]:
        """Compute entity-wide, cluster-wide, and global priors"""
        aggregate_priors = {}

        # 1. Entity-wide priors (entity_id:*)
        entity_episodes = defaultdict(list)
        for (entity_id, signal_category), episodes in grouped_episodes.items():
            entity_episodes[entity_id].extend(episodes)

        for entity_id, episodes in entity_episodes.items():
            if len(episodes) >= 2:
                # Compute aggregate prior (use OPERATIONS as placeholder)
                prior = self._compute_prior(entity_id, SignalCategory.OPERATIONS, episodes)
                key = f"{entity_id}:*"
                aggregate_priors[key] = prior

        # 2. Global category priors (*:category)
        category_episodes = defaultdict(list)
        for (entity_id, signal_category), episodes in grouped_episodes.items():
            category_episodes[signal_category].extend(episodes)

        for signal_category, episodes in category_episodes.items():
            if len(episodes) >= 2:
                prior = self._compute_prior("*", signal_category, episodes)
                key = f"*:{signal_category.value}"
                aggregate_priors[key] = prior

        # 3. Global baseline (*:*)
        all_episodes_flat = []
        for episodes in grouped_episodes.values():
            all_episodes_flat.extend(episodes)

        if len(all_episodes_flat) >= 2:
            prior = self._compute_prior("*", SignalCategory.OPERATIONS, all_episodes_flat)
            aggregate_priors["*:*"] = prior

        return aggregate_priors

    # ==========================================================================
    # RUNTIME API
    # ==========================================================================

    def get_multiplier(
        self,
        entity_id: str,
        signal_category: SignalCategory,
        current_date: Optional[datetime] = None
    ) -> TemporalMultiplierResponse:
        """
        Get temporal multiplier with backoff chain

        Args:
            entity_id: Entity identifier
            signal_category: Signal category
            current_date: Reference date (defaults to now)

        Returns:
            TemporalMultiplierResponse with multiplier in [0.75, 1.40]
        """
        current_date = current_date or datetime.now()
        current_quarter = SeasonalityAnalyzer.get_current_quarter(current_date)

        # Backoff chain
        search_keys = [
            f"{entity_id}:{signal_category.value}",      # 1. Exact match
            f"{entity_id}:*",                             # 2. Entity-wide
            f"{self._get_cluster_id(entity_id)}:{signal_category.value}" if self._get_cluster_id(entity_id) else None,  # 3. Cluster-category
            f"{self._get_cluster_id(entity_id)}:*" if self._get_cluster_id(entity_id) else None,       # 4. Cluster-wide
            f"*:{signal_category.value}",                 # 5. Global category
            "*:*"                                         # 6. Global baseline
        ]

        # Filter out None values
        search_keys = [k for k in search_keys if k is not None]

        backoff_levels = ["entity", "entity", "cluster", "cluster", "global", "global"]

        for i, key in enumerate(search_keys):
            if key in self.priors:
                prior = self.priors[key]
                multiplier = self._compute_multiplier(prior, current_quarter, current_date)

                return TemporalMultiplierResponse(
                    multiplier=multiplier,
                    backoff_level=backoff_levels[i],
                    confidence="high" if i < 2 else "medium" if i < 4 else "low",
                    prior=prior
                )

        # Fallback to global baseline
        return TemporalMultiplierResponse(
            multiplier=1.0,
            backoff_level="global",
            confidence="low",
            prior=None
        )

    def _compute_multiplier(
        self,
        prior: TemporalPrior,
        current_quarter: str,
        current_date: datetime
    ) -> float:
        """
        Compute multiplier from prior

        Formula:
        multiplier = seasonality_factor * recurrence_factor * momentum_factor

        Each factor is bounded, final result clamped to [0.75, 1.40]
        """
        multiplier = 1.0

        # 1. Seasonality factor (0.90 - 1.10)
        # If current quarter has high historical activity, boost multiplier
        seasonal_strength = prior.seasonality.get(current_quarter, 0.25)
        seasonal_factor = 0.90 + (0.20 * seasonal_strength * 4)  # Normalize to [0.90, 1.10]
        multiplier *= seasonal_factor

        # 2. Recurrence factor (0.95 - 1.10)
        # If we're close to expected next occurrence, boost multiplier
        if prior.recurrence_mean and prior.recurrence_std and prior.recurrence_std > 0:
            days_since_last = (current_date - prior.last_seen).days

            # Compute z-score (how many stds from mean)
            deviation = abs(days_since_last - prior.recurrence_mean) / prior.recurrence_std

            # Closer to expected = higher multiplier
            # deviation 0 → 1.10, deviation 3+ → 0.95
            recurrence_factor = max(0.95, 1.10 - (deviation * 0.05))
            multiplier *= recurrence_factor

        # 3. Momentum factor (0.95 - 1.20)
        # Recent activity boosts multiplier
        if prior.momentum_30d > 0:
            # Each event in last 30 days adds 0.05, capped at 1.20
            momentum_factor = min(1.20, 1.0 + (prior.momentum_30d * 0.05))
            multiplier *= momentum_factor

        # Clamp to [0.75, 1.40]
        return max(0.75, min(1.40, multiplier))

    def _get_cluster_id(self, entity_id: str) -> Optional[str]:
        """Get cluster ID for an entity"""
        # Try cache first
        if entity_id in self.entity_clusters:
            return self.entity_clusters[entity_id]

        # Try loading from cluster data
        cluster_file = Path("data/production_clusters.json")
        if cluster_file.exists():
            try:
                with open(cluster_file, 'r') as f:
                    clusters = json.load(f)

                    for entity in clusters.get('entities', []):
                        if entity.get('entity_id') == entity_id:
                            cluster_id = entity.get('cluster_id')
                            self.entity_clusters[entity_id] = cluster_id
                            return cluster_id

            except Exception as e:
                logger.debug(f"Failed to load cluster data: {e}")

        return None

    # ==========================================================================
    # PERSISTENCE
    # ==========================================================================

    def _load_priors(self):
        """Load priors from disk"""
        if self.priors_path.exists():
            try:
                with open(self.priors_path, 'r') as f:
                    data = json.load(f)

                    self.priors = {
                        key: TemporalPrior(**value)
                        for key, value in data.items()
                    }

                logger.info(f"✅ Loaded {len(self.priors)} priors from {self.priors_path}")

            except Exception as e:
                logger.warning(f"Failed to load priors: {e}")
                self.priors = {}
        else:
            logger.info(f"⚠️  No priors file found at {self.priors_path}")
            self.priors = {}

    def _save_priors(self, priors: Dict[str, TemporalPrior]):
        """Save priors to disk"""
        self.priors_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.priors_path, 'w') as f:
            json.dump(
                {key: prior.model_dump() for key, prior in priors.items()},
                f,
                indent=2,
                default=str
            )

        logger.info(f"✅ Saved {len(priors)} priors to {self.priors_path}")

    # ==========================================================================
    # CONVENIENCE METHODS
    # ==========================================================================

    async def get_prior_for_entity(
        self,
        entity_id: str,
        signal_category: SignalCategory
    ) -> Optional[TemporalPrior]:
        """
        Get prior for specific entity and category

        Returns None if not found (caller should use backoff)
        """
        key = f"{entity_id}:{signal_category.value}"
        return self.priors.get(key)

    def get_stats(self) -> Dict:
        """Get statistics about loaded priors"""
        entity_priors = sum(1 for k in self.priors.keys() if not k.startswith('*'))
        aggregate_priors = sum(1 for k in self.priors.keys() if k.startswith('*'))

        return {
            "total_priors": len(self.priors),
            "entity_priors": entity_priors,
            "aggregate_priors": aggregate_priors,
            "priors_file": str(self.priors_path),
            "file_exists": self.priors_path.exists()
        }


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def compute_temporal_priors(
    priors_path: str = "data/temporal_priors.json",
    min_sample_size: int = 2
) -> Dict:
    """
    Convenience function to compute all temporal priors

    Usage:
        result = await compute_temporal_priors()
        print(f"Computed {result['total_priors']} priors")
    """
    service = TemporalPriorService(priors_path)
    await service.compute_all_priors(min_sample_size=min_sample_size)

    return service.get_stats()


def get_temporal_multiplier(
    entity_id: str,
    signal_category: SignalCategory,
    priors_path: str = "data/temporal_priors.json"
) -> float:
    """
    Convenience function to get temporal multiplier

    Usage:
        multiplier = get_temporal_multiplier("arsenal", SignalCategory.CRM)
        print(f"Multiplier: {multiplier:.2f}")
    """
    service = TemporalPriorService(priors_path)
    result = service.get_multiplier(entity_id, signal_category)

    return result.multiplier
