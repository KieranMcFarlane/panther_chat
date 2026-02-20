"""
Graphiti Schema Extensions - Clusters and Templates

Extends Graphiti schema to support:
- Entity clusters (procurement behavior groups)
- Discovery templates (RFP signal patterns)
- Feedback loops (metrics, drift, missed signals)
"""

from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class GraphitiClusterTemplateManager:
    """Manages clusters and templates in Graphiti"""

    def __init__(self, graphiti_client):
        self.graphiti = graphiti_client

    async def create_cluster(self, cluster: Dict) -> Dict:
        """
        Create a cluster node in Graphiti

        Schema:
        (:Cluster {
            cluster_id: string,
            cluster_name: string,
            cluster_description: string,
            cluster_signature: {
                sport_types: [string],
                org_types: [string],
                governance_models: [string],
                revenue_band: [string],
                digital_maturity: [string],
                procurement_style: string
            },
            typical_signal_channels: [string],
            procurement_behavior_summary: string,
            expected_signal_types: [string],
            entity_count: int,
            created_at: datetime,
            last_reviewed: datetime,
            active: bool,
            metrics: {
                avg_verification_rate: float,
                avg_signal_acceptance_rate: float,
                missed_rfp_count: int,
                unclustered_growth_rate: float
            }
        })
        """

        cypher = """
        CREATE (c:Cluster {
            cluster_id: $cluster_id,
            cluster_name: $cluster_name,
            cluster_description: $cluster_description,
            cluster_signature: $cluster_signature,
            typical_signal_channels: $typical_signal_channels,
            procurement_behavior_summary: $procurement_behavior_summary,
            expected_signal_types: $expected_signal_types,
            entity_count: $entity_count,
            created_at: datetime(),
            last_reviewed: datetime(),
            active: true,
            metrics: $metrics
        })
        RETURN c
        """

        try:
            result = await self.graphiti.execute_query(cypher, {
                "cluster_id": cluster.get('cluster_id'),
                "cluster_name": cluster.get('cluster_name'),
                "cluster_description": cluster.get('cluster_description'),
                "cluster_signature": json.dumps(cluster.get('cluster_signature', {})),
                "typical_signal_channels": cluster.get('typical_signal_channels', []),
                "procurement_behavior_summary": cluster.get('procurement_behavior_summary'),
                "expected_signal_types": cluster.get('expected_signal_types', []),
                "entity_count": cluster.get('entity_count', 0),
                "metrics": json.dumps(cluster.get('metrics', {}))
            })

            logger.info(f"✅ Created cluster: {cluster.get('cluster_id')}")
            return result

        except Exception as e:
            logger.error(f"❌ Failed to create cluster: {e}")
            raise

    async def create_template(self, template: Dict) -> Dict:
        """
        Create a template node in Graphiti

        Schema:
        (:Template {
            template_id: string,
            template_name: string,
            cluster_id: string,
            version: int,
            status: string,
            created_at: datetime,
            confidence_score: float,
            applicable_entity_profile: {
                sports: [string],
                org_types: [string],
                revenue_bands: [string],
                digital_maturity: [string]
            },
            signal_channels: [{
                channel_type: string,
                example_domains: [string],
                signal_strength: string,
                scraping_priority: float,
                update_frequency: string,
                notes: string
            }],
            signal_patterns: [{
                pattern_name: string,
                description: string,
                early_indicators: [string],
                confidence_weight: float
            }],
            negative_filters: [string],
            verification_rules: [{
                rule: string,
                required: bool
            }],
            expected_false_positive_risk: string,
            metrics: {
                entities_using: int,
                avg_signals_per_entity: float,
                false_positive_rate: float,
                rfp_conversion_rate: float
            }
        })
        """

        cypher = """
        CREATE (t:Template {
            template_id: $template_id,
            template_name: $template_name,
            cluster_id: $cluster_id,
            version: $version,
            status: $status,
            created_at: datetime(),
            confidence_score: $confidence_score,
            applicable_entity_profile: $applicable_entity_profile,
            signal_channels: $signal_channels,
            signal_patterns: $signal_patterns,
            negative_filters: $negative_filters,
            verification_rules: $verification_rules,
            expected_false_positive_risk: $expected_false_positive_risk,
            metrics: $metrics
        })
        RETURN t
        """

        try:
            result = await self.graphiti.execute_query(cypher, {
                "template_id": template.get('template_id'),
                "template_name": template.get('template_name'),
                "cluster_id": template.get('cluster_id'),
                "version": template.get('version', 1),
                "status": "active",
                "confidence_score": template.get('template_confidence', 0.7),
                "applicable_entity_profile": json.dumps(template.get('applicable_entity_profile', {})),
                "signal_channels": json.dumps(template.get('signal_channels', [])),
                "signal_patterns": json.dumps(template.get('signal_patterns', [])),
                "negative_filters": template.get('negative_filters', []),
                "verification_rules": json.dumps(template.get('verification_rules', [])),
                "expected_false_positive_risk": template.get('expected_false_positive_risk', 'medium'),
                "metrics": json.dumps(template.get('metrics', {}))
            })

            logger.info(f"✅ Created template: {template.get('template_id')}")

            # Create relationship to cluster
            await self._link_template_to_cluster(
                template.get('template_id'),
                template.get('cluster_id')
            )

            return result

        except Exception as e:
            logger.error(f"❌ Failed to create template: {e}")
            raise

    async def _link_template_to_cluster(
        self,
        template_id: str,
        cluster_id: str
    ):
        """Create USES_TEMPLATE relationship between Cluster and Template"""

        cypher = """
        MATCH (c:Cluster {cluster_id: $cluster_id})
        MATCH (t:Template {template_id: $template_id})
        CREATE (c)-[:USES_TEMPLATE]->(t)
        """

        try:
            await self.graphiti.execute_query(cypher, {
                "cluster_id": cluster_id,
                "template_id": template_id
            })
            logger.info(f"  🔗 Linked {template_id} → {cluster_id}")
        except Exception as e:
            logger.warning(f"⚠️  Could not link template to cluster: {e}")

    async def classify_entity_to_cluster(
        self,
        entity_id: str,
        cluster_id: str,
        classification: Dict
    ):
        """
        Create BELONGS_TO relationship between Entity and Cluster

        Stores:
        - confidence score
        - classification date
        - reasoning
        - signals to watch
        """

        cypher = """
        MATCH (e:Entity {entity_id: $entity_id})
        MATCH (c:Cluster {cluster_id: $cluster_id})
        CREATE (e)-[r:BELONGS_TO {
            confidence: $confidence,
            classified_at: datetime(),
            reasoning: $reasoning,
            signals_to_watch: $signals_to_watch
        }]->(c)
        RETURN r
        """

        try:
            await self.graphiti.execute_query(cypher, {
                "entity_id": entity_id,
                "cluster_id": cluster_id,
                "confidence": classification.get('confidence', 0.0),
                "reasoning": classification.get('reasoning', ''),
                "signals_to_watch": classification.get('signals_to_watch', [])
            })
            logger.info(f"  🔗 Classified {entity_id} → {cluster_id} (confidence: {classification.get('confidence', 0.0)})")
        except Exception as e:
            logger.error(f"❌ Failed to classify entity: {e}")

    async def record_missed_signal(
        self,
        missed_signal: Dict
    ):
        """
        Record a missed signal for feedback loop

        Schema:
        (:MissedSignal {
            missed_signal_id: string,
            entity_id: string,
            cluster_id: string,
            template_id: string,
            actual_sources: [string],
            failure_stage: string,
            recorded_at: datetime,
            reviewed: bool,
            action_taken: string
        })
        """

        cypher = """
        CREATE (m:MissedSignal {
            missed_signal_id: $missed_signal_id,
            entity_id: $entity_id,
            cluster_id: $cluster_id,
            template_id: $template_id,
            actual_sources: $actual_sources,
            failure_stage: $failure_stage,
            recorded_at: datetime(),
            reviewed: false,
            action_taken: 'pending'
        })

        // Link to entity
        WITH m
        MATCH (e:Entity {entity_id: $entity_id})
        CREATE (e)-[:HAD_MISSED_SIGNAL]->(m)

        // Link to cluster
        WITH m
        MATCH (c:Cluster {cluster_id: $cluster_id})
        CREATE (c)-[:HAD_MISSED_SIGNAL]->(m)

        // Link to template
        WITH m
        MATCH (t:Template {template_id: $template_id})
        CREATE (t)-[:FEEDBACKS_INTO]->(m)

        RETURN m
        """

        try:
            await self.graphiti.execute_query(cypher, {
                "missed_signal_id": missed_signal.get('missed_signal_id'),
                "entity_id": missed_signal.get('entity_id'),
                "cluster_id": missed_signal.get('cluster_id'),
                "template_id": missed_signal.get('template_id'),
                "actual_sources": json.dumps(missed_signal.get('actual_sources', [])),
                "failure_stage": missed_signal.get('failure_stage', 'unknown')
            })
            logger.info(f"✅ Recorded missed signal: {missed_signal.get('missed_signal_id')}")
        except Exception as e:
            logger.error(f"❌ Failed to record missed signal: {e}")

    async def update_cluster_metrics(
        self,
        cluster_id: str,
        metrics: Dict
    ):
        """Update cluster metrics for drift detection"""

        cypher = """
        MATCH (c:Cluster {cluster_id: $cluster_id})
        SET c.metrics = $metrics,
            c.last_reviewed = datetime()
        RETURN c
        """

        try:
            await self.graphiti.execute_query(cypher, {
                "cluster_id": cluster_id,
                "metrics": json.dumps(metrics)
            })
            logger.info(f"✅ Updated metrics for cluster: {cluster_id}")
        except Exception as e:
            logger.error(f"❌ Failed to update metrics: {e}")

    async def get_entities_for_cluster(
        self,
        cluster_id: str
    ) -> List[Dict]:
        """Get all entities belonging to a cluster"""

        cypher = """
        MATCH (e:Entity)-[r:BELONGS_TO]->(c:Cluster {cluster_id: $cluster_id})
        RETURN e.entity_id as entity_id,
               e.name as name,
               e.sport as sport,
               r.confidence as confidence,
               r.classified_at as classified_at
        ORDER BY r.confidence DESC
        """

        try:
            results = await self.graphiti.execute_query(cypher, {
                "cluster_id": cluster_id
            })
            return results
        except Exception as e:
            logger.error(f"❌ Failed to get entities for cluster: {e}")
            return []

    async def detect_cluster_drift(
        self,
        cluster_id: str
    ) -> Dict:
        """
        Analyze cluster metrics to detect drift

        Returns:
            Drift analysis with recommended action
        """

        # Get cluster with metrics
        cypher = """
        MATCH (c:Cluster {cluster_id: $cluster_id})
        RETURN c.cluster_name as cluster_name,
               c.metrics as metrics,
               c.entity_count as entity_count
        """

        try:
            results = await self.graphiti.execute_query(cypher, {"cluster_id": cluster_id})

            if not results:
                return {"drift_detected": False, "reason": "Cluster not found"}

            cluster_data = results[0]
            metrics = json.loads(cluster_data.get('metrics', '{}'))

            # Analyze drift
            drift_indicators = []
            severity = "low"

            if metrics.get('avg_verification_rate', 1.0) < 0.5:
                drift_indicators.append("Low verification rate")
                severity = "high"

            if metrics.get('avg_signal_acceptance_rate', 1.0) < 0.6:
                drift_indicators.append("Low signal acceptance rate")
                severity = "medium"

            if metrics.get('missed_rfp_count', 0) >= 3:
                drift_indicators.append("Multiple missed RFPs")
                severity = "high"

            if metrics.get('unclustered_growth_rate', 0.0) > 0.15:
                drift_indicators.append("High unclustered entity growth")
                severity = "medium"

            # Recommend action
            if severity == "high":
                action = "refine_template"
            elif severity == "medium":
                action = "review_cluster"
            else:
                action = "no_change"

            return {
                "cluster_id": cluster_id,
                "cluster_name": cluster_data.get('cluster_name'),
                "drift_detected": len(drift_indicators) > 0,
                "severity": severity,
                "primary_indicators": drift_indicators,
                "recommended_action": action
            }

        except Exception as e:
            logger.error(f"❌ Drift detection failed: {e}")
            return {
                "cluster_id": cluster_id,
                "drift_detected": False,
                "error": str(e)
            }


# Import json for schema
import json
