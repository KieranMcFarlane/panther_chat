"""
Entity Clustering Service

Groups entities by PROCUREMENT BEHAVIOR, not just sport/geography.
This is the strategic layer that enables scalable template discovery.
"""

import asyncio
import json
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class EntityClusterer:
    """Clusters entities by procurement behavior patterns"""

    def __init__(self, graphiti_client=None):
        self.graphiti = graphiti_client
        self.clusters = []

    async def cluster_entities(
        self,
        entities: List[Dict],
        use_claude: bool = True,
        model: str = "sonnet"  # Sonnet for complex reasoning
    ) -> List[Dict]:
        """
        Cluster entities by procurement behavior

        Args:
            entities: List of entity dicts with attributes
            use_claude: Whether to use Claude for clustering
            model: Model to use (sonnet/haiku)

        Returns:
            List of cluster definitions
        """
        logger.info(f"🔄 Clustering {len(entities)} entities by procurement behavior")

        if use_claude:
            # Use Claude for intelligent clustering
            clusters = await self._cluster_with_claude(entities, model)
        else:
            # Use rule-based clustering (fallback)
            clusters = await self._cluster_with_rules(entities)

        logger.info(f"✅ Generated {len(clusters)} clusters")
        return clusters

    async def cluster_entities_production(
        self,
        entities: List[Dict],
        batch_size: int = 100,
        checkpoint_file: str = "data/clustering_checkpoint.json",
        model: str = "sonnet"
    ) -> List[Dict]:
        """
        Cluster all entities (3,400+) in batches with checkpoint support

        Args:
            entities: All entities to cluster
            batch_size: Number of entities per batch (default: 100)
            checkpoint_file: File to save/load checkpoint
            model: Model to use for clustering (sonnet/haiku)

        Returns:
            List of all cluster definitions
        """
        logger.info(f"🚀 Production clustering: {len(entities)} entities in batches of {batch_size}")

        # Load checkpoint if exists
        completed_batches = set()
        all_clusters = []

        if Path(checkpoint_file).exists():
            try:
                with open(checkpoint_file, 'r') as f:
                    checkpoint = json.load(f)
                    completed_batches = set(checkpoint.get('completed_batches', []))
                    all_clusters = checkpoint.get('clusters', [])
                    logger.info(f"📂 Resuming from checkpoint: {len(completed_batches)} batches completed")
            except Exception as e:
                logger.warning(f"⚠️  Failed to load checkpoint: {e}")

        # Process entities in batches
        total_batches = (len(entities) + batch_size - 1) // batch_size

        for batch_num in range(total_batches):
            if batch_num in completed_batches:
                logger.info(f"✓ Batch {batch_num + 1}/{total_batches} already completed, skipping")
                continue

            start_idx = batch_num * batch_size
            end_idx = min((batch_num + 1) * batch_size, len(entities))
            batch_entities = entities[start_idx:end_idx]

            logger.info(f"🔄 Processing batch {batch_num + 1}/{total_batches} (entities {start_idx}-{end_idx})")

            try:
                # Cluster this batch
                batch_clusters = await self._cluster_batch_with_claude(batch_entities, batch_num, model)

                # Merge with existing clusters
                all_clusters = self._merge_clusters(all_clusters, batch_clusters)

                # Mark batch as complete
                completed_batches.add(batch_num)

                # Save checkpoint
                self._save_checkpoint(
                    checkpoint_file,
                    completed_batches,
                    all_clusters,
                    batch_num + 1,
                    total_batches
                )

                logger.info(f"✅ Batch {batch_num + 1}/{total_batches} complete")

            except Exception as e:
                logger.error(f"❌ Failed to process batch {batch_num + 1}: {e}")
                logger.info(f"💾 Checkpoint saved at batch {batch_num}, resume with same command")
                raise

        logger.info(f"✅ Production clustering complete: {len(all_clusters)} clusters from {len(entities)} entities")
        return all_clusters

    async def _cluster_batch_with_claude(
        self,
        entities: List[Dict],
        batch_num: int,
        model: str = "sonnet"
    ) -> List[Dict]:
        """Cluster a single batch of entities with Claude"""

        from anthropic import Anthropic

        client = Anthropic(
            base_url="https://api.z.ai/api/anthropic",
            api_key=os.getenv("ANTHROPIC_API_KEY", "")
        )

        prompt = self._build_clustering_prompt(entities)

        try:
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022" if model == "sonnet" else "claude-3-5-haiku-20241022",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.3  # Lower temp for more deterministic clustering
            )

            # Parse JSON response
            response_text = response.content[0].text
            logger.info(f"Claude response length: {len(response_text)} chars")

            clusters_data = self._extract_json(response_text)

            # Check if we got valid clusters
            if not clusters_data or (isinstance(clusters_data, dict) and not clusters_data.get('clusters')):
                logger.warning("⚠️  Claude returned empty/invalid clusters, using rule-based fallback")
                return await self._cluster_with_rules(entities)

            # Handle if clusters_data is wrapped
            if isinstance(clusters_data, dict) and 'clusters' in clusters_data:
                clusters_data = clusters_data['clusters']

            # Validate and refine clusters
            clusters = await self._validate_clusters(clusters_data, entities)

            # If no valid clusters, use fallback
            if not clusters:
                logger.warning("⚠️  No valid clusters after validation, using rule-based fallback")
                return await self._cluster_with_rules(entities)

            return clusters

        except Exception as e:
            logger.error(f"❌ Claude clustering failed for batch {batch_num}: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            # Fallback to rule-based clustering for this batch
            return await self._cluster_with_rules(entities)

    def _merge_clusters(
        self,
        existing_clusters: List[Dict],
        new_clusters: List[Dict]
    ) -> List[Dict]:
        """Merge new clusters with existing clusters, combining duplicates"""

        # Build lookup by cluster_id
        cluster_map = {
            c.get('cluster_id'): c
            for c in existing_clusters
        }

        # Merge or add new clusters
        for new_cluster in new_clusters:
            cluster_id = new_cluster.get('cluster_id')

            if cluster_id in cluster_map:
                # Merge example entities
                existing = cluster_map[cluster_id]
                existing_entities = set(existing.get('example_entities', []))
                new_entities = set(new_cluster.get('example_entities', []))

                existing['example_entities'] = list(existing_entities.union(new_entities))
                existing['entity_count'] = len(existing['example_entities'])
            else:
                # Add new cluster
                cluster_map[cluster_id] = new_cluster

        return list(cluster_map.values())

    def _save_checkpoint(
        self,
        checkpoint_file: str,
        completed_batches: set,
        clusters: List[Dict],
        current_batch: int,
        total_batches: int
    ):
        """Save clustering progress to checkpoint file"""

        checkpoint = {
            'completed_batches': sorted(list(completed_batches)),
            'clusters': clusters,
            'progress': f"{current_batch}/{total_batches} batches",
            'updated_at': datetime.now().isoformat()
        }

        checkpoint_path = Path(checkpoint_file)
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2)

        logger.info(f"💾 Checkpoint saved: {checkpoint_file}")

    async def _cluster_with_claude(
        self,
        entities: List[Dict],
        model: str = "sonnet"
    ) -> List[Dict]:
        """Use Claude to cluster entities by procurement behavior"""

        # For backward compatibility, delegate to production method
        return await self.cluster_entities_production(
            entities,
            batch_size=100,
            checkpoint_file="data/clustering_checkpoint.json"
        )

    def _build_clustering_prompt(self, entities: List[Dict]) -> str:
        """Build the clustering prompt for Claude"""

        entities_text = json.dumps(entities, indent=2)

        return f"""You are an intelligence architect responsible for clustering entities into groups that share similar procurement behavior and signal discovery patterns.

Your goal is NOT taxonomy for taxonomy's sake.
Your goal is to enable scalable, high-precision signal detection and RFP prediction.

Clusters must be:
- Actionable for scraping strategy
- Stable over time
- Interpretable by humans
- Reusable as template inputs

You must prefer fewer, stronger clusters over many weak ones.

INPUT
-----
You are given {len(entities)} sports-related entities.

Each entity has attributes:
- entity_id
- name
- sport
- country
- league_or_competition
- ownership_type (public, private, state-backed, unknown)
- org_type (club, league, federation, venue, broadcaster)
- estimated_revenue_band (low, medium, high, unknown)
- digital_maturity (low, medium, high, unknown)

OBJECTIVE
---------
Cluster these entities into groups that are likely to exhibit SIMILAR RFP READINESS AND PROCUREMENT SIGNAL PATTERNS.

These clusters will be used to:
- Generate scraping templates
- Define BrightData targeting strategy
- Predict pre-RFP readiness
- Reduce noise and scraping cost

IMPORTANT CONSTRAINTS
---------------------
- Do NOT cluster purely by sport or geography.
- Do NOT create clusters smaller than ~15 entities.
- Assume clusters must generalize to thousands of future entities.
- If two clusters behave the same for RFP discovery, merge them.

ENTITIES TO CLUSTER
-------------------
{entities_text}

OUTPUT FORMAT (STRICT JSON)
---------------------------
Return an array of cluster objects:

[
  {{
    "cluster_id": "string",
    "cluster_name": "string",
    "cluster_description": "string",

    "cluster_signature": {{
      "sport_types": ["string"],
      "org_types": ["string"],
      "governance_models": ["string"],
      "revenue_band": ["string"],
      "digital_maturity": ["string"],
      "procurement_style": "centralized|decentralized|mixed"
    }},

    "typical_signal_channels": [
      "official_sites",
      "job_boards",
      "league_sites",
      "tender_portals",
      "press",
      "other"
    ],

    "procurement_behavior_summary": "string",

    "example_entities": ["entity_id"],

    "expected_signal_types": [
      "explicit_rfp",
      "vendor_switch",
      "leadership_hire",
      "platform_migration",
      "strategic_review"
    ]
  }}
]

Also return:
{{
  "unclustered_entities": ["entity_id"],
  "notes": "string"
}}

Respond ONLY with valid JSON. No explanation outside the JSON.
"""

    def _extract_json(self, text: str) -> Dict:
        """Extract JSON from Claude response"""
        try:
            # Try direct parse first
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON block
            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end > start:
                json_text = text[start:end]
                return json.loads(json_text)
            raise

    async def _validate_clusters(
        self,
        clusters_data: Dict,
        entities: List[Dict]
    ) -> List[Dict]:
        """Validate and refine clusters"""

        clusters = clusters_data if isinstance(clusters_data, list) else [clusters_data]

        # Ensure each cluster has required fields
        validated_clusters = []
        entity_ids = {e.get('entity_id') for e in entities}

        for cluster in clusters:
            # Validate cluster has entities
            example_entities = cluster.get('example_entities', [])
            valid_entities = [e for e in example_entities if e in entity_ids]

            if len(valid_entities) >= 5:  # Minimum cluster size
                cluster['example_entities'] = valid_entities
                cluster['entity_count'] = len(valid_entities)
                validated_clusters.append(cluster)

        logger.info(f"✅ Validated {len(validated_clusters)} clusters")
        return validated_clusters

    async def _cluster_with_rules(self, entities: List[Dict]) -> List[Dict]:
        """Rule-based clustering (fallback when Claude unavailable)"""

        logger.info("Using rule-based clustering fallback")

        clusters = []

        # Rule 1: Elite clubs with high digital maturity
        elite_digital = [
            e for e in entities
            if e.get('estimated_revenue_band') == 'high'
            and e.get('digital_maturity') == 'high'
            and e.get('org_type') == 'club'
        ]

        if elite_digital:
            clusters.append({
                "cluster_id": "elite_clubs_high_digital",
                "cluster_name": "Elite Clubs with In-House Digital Teams",
                "cluster_description": "Large clubs with internal digital, data, and fan engagement teams",
                "cluster_signature": {
                    "sport_types": ["football", "basketball", "cricket"],
                    "org_types": ["club"],
                    "governance_models": ["private", "state-backed"],
                    "revenue_band": ["high"],
                    "digital_maturity": ["high"],
                    "procurement_style": "mixed"
                },
                "typical_signal_channels": ["job_boards", "official_sites", "press"],
                "procurement_behavior_summary": "Procurement intent appears first via senior hires and platform changes",
                "example_entities": [e.get('entity_id') for e in elite_digital[:20]],
                "entity_count": len(elite_digital),
                "expected_signal_types": ["leadership_hire", "platform_migration", "explicit_rfp"]
            })

        # Rule 2: Governing bodies
        governing_bodies = [
            e for e in entities
            if e.get('org_type') in ['federation', 'league']
        ]

        if governing_bodies:
            clusters.append({
                "cluster_id": "governing_bodies_global",
                "cluster_name": "Global Governing Bodies & Leagues",
                "cluster_description": "International federations and major leagues",
                "cluster_signature": {
                    "sport_types": ["football", "cricket", "basketball"],
                    "org_types": ["federation", "league"],
                    "governance_models": ["public", "non-profit"],
                    "revenue_band": ["high", "medium"],
                    "digital_maturity": ["medium", "high"],
                    "procurement_style": "centralized"
                },
                "typical_signal_channels": ["official_sites", "tender_portals", "press"],
                "procurement_behavior_summary": "Centralized procurement with formal tender processes",
                "example_entities": [e.get('entity_id') for e in governing_bodies[:20]],
                "entity_count": len(governing_bodies),
                "expected_signal_types": ["explicit_rfp", "tender_release", "strategic_review"]
            })

        # Rule 3: Mid-tier clubs
        mid_tier = [
            e for e in entities
            if e.get('estimated_revenue_band') in ['medium', 'low']
            and e.get('org_type') == 'club'
        ]

        if mid_tier:
            clusters.append({
                "cluster_id": "mid_tier_clubs_standard",
                "cluster_name": "Mid-Tier Clubs with Standard Procurement",
                "cluster_description": "Mid-market clubs with traditional procurement cycles",
                "cluster_signature": {
                    "sport_types": ["football", "cricket", "rugby"],
                    "org_types": ["club"],
                    "governance_models": ["private", "public"],
                    "revenue_band": ["medium", "low"],
                    "digital_maturity": ["medium", "low"],
                    "procurement_style": "decentralized"
                },
                "typical_signal_channels": ["job_boards", "local_press", "league_sites"],
                "procurement_behavior_summary": "Less predictable procurement, often vendor-driven",
                "example_entities": [e.get('entity_id') for e in mid_tier[:20]],
                "entity_count": len(mid_tier),
                "expected_signal_types": ["explicit_rfp", "vendor_switch", "leadership_hire"]
            })

        return clusters

    async def classify_entity(
        self,
        entity: Dict,
        clusters: List[Dict],
        use_claude: bool = True
    ) -> Dict:
        """
        Classify a new entity into an existing cluster

        Args:
            entity: Entity dict
            clusters: Existing cluster definitions
            use_claude: Whether to use Claude for classification

        Returns:
            Classification result with cluster_id and confidence
        """

        if use_claude:
            return await self._classify_with_claude(entity, clusters)
        else:
            return await self._classify_with_rules(entity, clusters)

    async def _classify_with_claude(
        self,
        entity: Dict,
        clusters: List[Dict]
    ) -> Dict:
        """Use Claude to classify entity into cluster"""

        from anthropic import Anthropic

        client = Anthropic(
            base_url="https://api.z.ai/api/anthropic",
            api_key=os.getenv("ANTHROPIC_API_KEY", "")
        )

        prompt = self._build_classification_prompt(entity, clusters)

        try:
            response = client.messages.create(
                model="claude-3-5-haiku-20241022",  # Haiku for classification
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.2
            )

            response_text = response.content[0].text
            result = self._extract_json(response_text)

            return result

        except Exception as e:
            logger.error(f"❌ Claude classification failed: {e}")
            return await self._classify_with_rules(entity, clusters)

    def _build_classification_prompt(self, entity: Dict, clusters: List[Dict]) -> str:
        """Build classification prompt"""

        clusters_text = json.dumps(clusters, indent=2)
        entity_text = json.dumps(entity, indent=2)

        return f"""You are an entity classification engine.

Your job is to assign a new entity to an existing procurement-behavior cluster
based on how it is likely to signal RFP intent — NOT brand similarity.

You must be conservative.
If the entity does not clearly match a cluster signature, mark it as UNCLUSTERED.

Never invent clusters.
Never force-fit an entity.

EXISTING CLUSTERS
-----------------
{clusters_text}

NEW ENTITY
----------
{entity_text}

TASK
----
1. Compare the entity against each cluster signature.
2. Score similarity based on procurement behavior alignment.
3. Assign the entity to the BEST matching cluster if confidence ≥ 0.7.
4. Otherwise mark as UNCLUSTERED.

OUTPUT FORMAT (STRICT JSON)
---------------------------
{{
  "entity_id": "string",
  "assigned_cluster_id": "string | null",
  "confidence": number,
  "reasoning": "string",
  "signals_to_watch": [
    "job_hires",
    "platform_changes",
    "vendor_mentions",
    "explicit_rfp",
    "press_announcements"
  ]
}}

Respond ONLY with valid JSON.
"""

    async def _classify_with_rules(
        self,
        entity: Dict,
        clusters: List[Dict]
    ) -> Dict:
        """Rule-based classification (fallback)"""

        entity_id = entity.get('entity_id')
        org_type = entity.get('org_type')
        revenue_band = entity.get('estimated_revenue_band')
        digital_maturity = entity.get('digital_maturity')

        # Rule: Match elite digital cluster
        if (org_type == 'club' and
            revenue_band == 'high' and
            digital_maturity == 'high'):

            return {
                "entity_id": entity_id,
                "assigned_cluster_id": "elite_clubs_high_digital",
                "confidence": 0.8,
                "reasoning": "Matches elite club profile with high digital maturity",
                "signals_to_watch": ["job_hires", "platform_changes", "explicit_rfp"]
            }

        # Rule: Match governing bodies
        if org_type in ['federation', 'league']:
            return {
                "entity_id": entity_id,
                "assigned_cluster_id": "governing_bodies_global",
                "confidence": 0.85,
                "reasoning": "Governing body or league organization",
                "signals_to_watch": ["explicit_rfp", "tender_release", "press_announcements"]
            }

        # Default: mid-tier
        return {
            "entity_id": entity_id,
            "assigned_cluster_id": "mid_tier_clubs_standard",
            "confidence": 0.6,
            "reasoning": "Default classification to mid-tier cluster",
            "signals_to_watch": ["explicit_rfp", "vendor_switch"]
        }

    async def save_clusters_to_graphiti(self, clusters: List[Dict]):
        """Save clusters to Graphiti for persistence"""

        if not self.graphiti:
            logger.warning("No Graphiti client provided, skipping save")
            return

        logger.info(f"💾 Saving {len(clusters)} clusters to Graphiti")

        for cluster in clusters:
            try:
                await self.graphiti.create_cluster(cluster)
                logger.info(f"✅ Saved cluster: {cluster.get('cluster_id')}")
            except Exception as e:
                logger.error(f"❌ Failed to save cluster {cluster.get('cluster_id')}: {e}")

        logger.info("✅ All clusters saved to Graphiti")


async def main():
    """CLI for entity clustering"""

    import argparse

    parser = argparse.ArgumentParser(description="Cluster entities by procurement behavior")
    parser.add_argument("--input", required=True, help="Input JSON file with entities")
    parser.add_argument("--output", required=True, help="Output JSON file for clusters")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for processing")
    parser.add_argument("--checkpoint-file", default="data/clustering_checkpoint.json", help="Checkpoint file")
    parser.add_argument("--use-claude", action="store_true", default=True, help="Use Claude for clustering")

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Load entities
    logger.info(f"📂 Loading entities from {args.input}...")

    with open(args.input, 'r') as f:
        data = json.load(f)

    entities = data.get("entities", [])
    logger.info(f"✅ Loaded {len(entities)} entities")

    # Cluster entities
    clusterer = EntityClusterer()

    if args.use_claude:
        # Use production batch processing
        clusters = await clusterer.cluster_entities_production(
            entities,
            batch_size=args.batch_size,
            checkpoint_file=args.checkpoint_file
        )
    else:
        # Use simple clustering
        clusters = await clusterer.cluster_entities(
            entities,
            use_claude=False
        )

    # Save clusters
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(args.output, 'w') as f:
        json.dump(clusters, f, indent=2)

    logger.info(f"💾 Saved {len(clusters)} clusters to {args.output}")
    logger.info("✅ Clustering complete!")


if __name__ == "__main__":
    asyncio.run(main())

