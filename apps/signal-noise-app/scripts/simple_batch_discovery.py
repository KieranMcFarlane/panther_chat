#!/usr/bin/env python3
"""
Simple Batch Template Discovery - Template Inheritance Only

Creates runtime bindings for all entities in clusters by matching them to templates.
Pattern discovery via 30-iteration exploration is deferred to on-demand execution.

Usage:
    python scripts/simple_batch_discovery.py
"""

import json
import logging
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    handlers=[
        logging.FileHandler('data/batch_discovery.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def load_entities() -> list:
    """Load all entities from data/all_entities.json"""
    logger.info("📂 Loading entities...")

    entities_file = Path("data/all_entities.json")

    with open(entities_file) as f:
        data = json.load(f)

    entities = data.get("entities", [])

    logger.info(f"✅ Loaded {len(entities):,} entities")
    return entities


def load_clusters() -> dict:
    """Load production clusters"""
    logger.info("📂 Loading clusters...")

    clusters_file = Path("data/production_clusters.json")

    with open(clusters_file) as f:
        clusters_list = json.load(f)

    clusters = {c["cluster_id"]: c for c in clusters_list}

    logger.info(f"✅ Loaded {len(clusters):,} clusters")
    return clusters


def load_templates() -> dict:
    """Load production templates"""
    logger.info("📂 Loading templates...")

    templates_file = Path("bootstrapped_templates/production_templates.json")

    with open(templates_file) as f:
        templates_list = json.load(f)

    templates = {t.get("template_id", f"tpl_{i}"): t for i, t in enumerate(templates_list)}

    logger.info(f"✅ Loaded {len(templates):,} templates")
    return templates


def create_entity_cluster_mapping(clusters: dict) -> dict:
    """Create entity to cluster mapping from clusters"""
    logger.info("📂 Creating entity-cluster mapping...")

    mapping = {}
    for cluster_id, cluster in clusters.items():
        for entity_id in cluster.get("example_entities", []):
            mapping[entity_id] = cluster_id

    logger.info(f"✅ Created mapping for {len(mapping):,} entities")

    # Save mapping
    with open("data/entity_cluster_mapping.json", 'w') as f:
        json.dump(mapping, f, indent=2)

    return mapping


def match_entity_to_template(entity_id: str, cluster_id: str, templates: dict) -> dict:
    """Match entity to template via cluster_id"""

    # Try direct match
    for template_id, template in templates.items():
        if template.get("cluster_id") == cluster_id:
            return template

    # Try fuzzy match
    for template_id, template in templates.items():
        template_cluster = template.get("cluster_id", "")
        if cluster_id in template_cluster or template_cluster in cluster_id:
            return template

    return None


def create_runtime_binding(entity: dict, template: dict) -> dict:
    """Create runtime binding from entity and template"""

    entity_id = entity.get("entity_id")
    entity_name = entity.get("name")
    template_id = template.get("template_id", "unknown")

    # Extract patterns from template
    template_patterns = {}
    signal_patterns = template.get("signal_patterns", [])

    for pattern in signal_patterns:
        pattern_name = pattern.get("pattern_name", "Unknown Pattern")
        template_patterns[pattern_name] = {
            "patterns_found": pattern.get("early_indicators", []),
            "confidence": pattern.get("confidence_weight", 0.7),
            "iterations_used": 0,
            "source": "template"
        }

    binding = {
        "entity_id": entity_id,
        "entity_name": entity_name,
        "template_id": template_id,
        "discovered_at": datetime.now().isoformat(),
        "domains": [],  # Empty initially, can be filled later
        "channels": {
            "jobs": "",
            "careers": "",
            "news": "",
            "press": ""
        },
        "patterns": template_patterns,
        "performance_metrics": {
            "total_iterations": 0,
            "categories_discovered": len(template_patterns),
            "overall_confidence": template.get("template_confidence", 0.70),
            "total_cost_usd": 0.0,
            "binding_type": "template_inherited"
        },
        "next_refresh": (datetime.now().timestamp() + 90 * 86400)  # 90 days
    }

    return binding


def main():
    """Main execution"""
    logger.info("")
    logger.info("="*70)
    logger.info("SIMPLE BATCH TEMPLATE DISCOVERY")
    logger.info("="*70)
    logger.info("Creating template-based bindings for all clustered entities")
    logger.info("")

    # Load data
    entities = load_entities()
    clusters = load_clusters()
    templates = load_templates()

    # Create mapping
    entity_cluster_mapping = create_entity_cluster_mapping(clusters)

    # Process entities
    runtime_bindings_dir = Path("data/runtime_bindings")
    runtime_bindings_dir.mkdir(parents=True, exist_ok=True)

    results = {
        "total_entities": len(entity_cluster_mapping),
        "processed": 0,
        "successful": 0,
        "failed": 0,
        "failed_entities": []
    }

    for entity_id, cluster_id in entity_cluster_mapping.items():
        # Find entity details
        entity = next((e for e in entities if e.get("entity_id") == entity_id), None)

        if not entity:
            logger.warning(f"⚠️  Entity not found: {entity_id}")
            results["failed"] += 1
            results["failed_entities"].append({"entity_id": entity_id, "reason": "Entity not found"})
            continue

        # Match to template
        template = match_entity_to_template(entity_id, cluster_id, templates)

        if not template:
            logger.warning(f"⚠️  No template found for {entity_id} (cluster: {cluster_id})")
            results["failed"] += 1
            results["failed_entities"].append({"entity_id": entity_id, "reason": f"No template for cluster: {cluster_id}"})
            continue

        # Create binding
        binding = create_runtime_binding(entity, template)

        # Save binding
        binding_file = runtime_bindings_dir / f"{entity_id}.json"
        with open(binding_file, 'w') as f:
            json.dump(binding, f, indent=2)

        results["processed"] += 1
        results["successful"] += 1

        if results["processed"] % 100 == 0:
            logger.info(f"  Progress: {results['processed']}/{results['total_entities']} ({results['processed']*100//results['total_entities']}%)")

    # Final report
    logger.info("")
    logger.info("="*70)
    logger.info("DISCOVERY COMPLETE")
    logger.info("="*70)
    logger.info(f"Total entities: {results['total_entities']:,}")
    logger.info(f"Processed: {results['processed']:,}")
    logger.info(f"Successful: {results['successful']:,}")
    logger.info(f"Failed: {results['failed']:,}")

    if results["failed_entities"]:
        logger.info(f"\n❌ Failed entities (first 10):")
        for failure in results["failed_entities"][:10]:
            logger.info(f"   • {failure['entity_id']}: {failure['reason']}")

    # Save results
    results_file = Path("data") / f"discovery_report_simple_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)

    logger.info(f"\n✅ Results saved to: {results_file}")


if __name__ == "__main__":
    main()
