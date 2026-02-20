#!/usr/bin/env python3
"""
Test Template Bootstrap System

Demonstrates the clustering + template discovery pipeline:
1. Clusters entities by procurement behavior
2. Discovers RFP signal templates for each cluster
3. Shows how templates would be used for targeted scraping

Run with:
    python3 test_template_bootstrap.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from template_bootstrap import TemplateBootstrapPipeline


async def test_bootstrap_pipeline():
    """Test the complete template bootstrap pipeline"""

    print("\n" + "="*80)
    print("🧪 TEMPLATE BOOTSTRAP TEST")
    print("="*80 + "\n")

    pipeline = TemplateBootstrapPipeline()

    # Run pipeline with sample entities
    print("📋 Running bootstrap pipeline...\n")
    results = await pipeline.run(
        entities_file=None,  # Use built-in sample entities
        use_claude=True,  # Use Claude for clustering
        use_brightdata=False,  # MCP not configured in test
        output_dir="./bootstrapped_templates"
    )

    clusters = results['clusters']
    templates = results['templates']
    report = results['report']

    # Display clusters
    print("\n" + "="*80)
    print("📊 CLUSTERS DISCOVERED")
    print("="*80 + "\n")

    for i, cluster in enumerate(sorted(clusters, key=lambda c: c.get('entity_count', 0), reverse=True), 1):
        print(f"{i}. {cluster.get('cluster_name')}")
        print(f"   Cluster ID: {cluster.get('cluster_id')}")
        print(f"   Entities: {cluster.get('entity_count', 0)}")
        print(f"   Procurement Style: {cluster.get('cluster_signature', {}).get('procurement_style')}")
        print(f"   Expected Signals: {', '.join(cluster.get('expected_signal_types', []))}")
        print(f"   Example Entities: {', '.join(cluster.get('example_entities', [])[:3])}")
        print()

    # Display templates
    print("\n" + "="*80)
    print("📋 TEMPLATES DISCOVERED")
    print("="*80 + "\n")

    for i, template in enumerate(templates, 1):
        print(f"{i}. {template.get('template_name')}")
        print(f"   Template ID: {template.get('template_id')}")
        print(f"   Cluster: {template.get('cluster_id')}")
        print(f"   Confidence: {template.get('template_confidence', 0):.2f}")

        channels = template.get('signal_channels', [])
        if channels:
            print(f"   Signal Channels ({len(channels)}):")
            for ch in channels[:3]:  # Show first 3
                print(f"     - {ch.get('channel_type')}: {ch.get('example_domains', [])[:2]} (priority: {ch.get('scraping_priority', 0)})")
            if len(channels) > 3:
                print(f"     ... and {len(channels) - 3} more")

        patterns = template.get('signal_patterns', [])
        if patterns:
            print(f"   Signal Patterns ({len(patterns)}):")
            for p in patterns[:3]:
                print(f"     - {p.get('pattern_name')}: {p.get('early_indicators', [])[:2]}")
            if len(patterns) > 3:
                print(f"     ... and {len(patterns) - 3} more")

        print()

    # Display metrics
    print("\n" + "="*80)
    print("📈 BOOTSTRAP METRICS")
    print("="*80 + "\n")

    metrics = report.get('metrics', {})
    print(f"Total Entities: {metrics.get('total_entities', 0)}")
    print(f"Clusters Created: {metrics.get('clusters_created', 0)}")
    print(f"Templates Discovered: {metrics.get('templates_discovered', 0)}")
    print(f"Coverage: {metrics.get('coverage_percentage', 0):.1f}%")
    print(f"Avg Entities per Cluster: {metrics.get('avg_entities_per_cluster', 0):.1f}")

    # Display recommendations
    print("\n" + "="*80)
    print("💡 RECOMMENDATIONS")
    print("="*80 + "\n")

    recommendations = report.get('recommendations', [])
    for rec in recommendations:
        print(f"  {rec}")

    # Show example usage
    print("\n" + "="*80)
    print("🚀 HOW TO USE TEMPLATES")
    print("="*80 + "\n")

    print("1. New entity is added:")
    print("   → Auto-classify to cluster using signature matching")
    print("   → Inherit cluster's template")
    print()

    print("2. BrightData executes template:")
    print("   → Scrape only high-priority channels")
    print("   → Focus on specific URL patterns")
    print("   → Filter out noise using negative_filters")
    print()

    print("3. Evidence verification (Pass 1.5):")
    print("   → Verify scraped URLs are accessible")
    print("   → Validate source credibility")
    print("   → Adjust confidence based on verification")
    print()

    print("4. Claude validates (Pass 2):")
    print("   → Sees VERIFIED evidence from targeted sources")
    print("   → Knows which cluster/template was used")
    print("   → Assigns confidence based on actual evidence quality")
    print()

    print("5. Feedback loop:")
    print("   → Track metrics per template (verification rate, signal density)")
    print("   → Detect drift (metrics degrading)")
    print("   → Refine templates quarterly or when drift detected")
    print()

    print("="*80)
    print("✅ TEST COMPLETE")
    print("="*80)
    print("\nNext steps:")
    print("  1. Review generated clusters in: ./bootstrapped_templates/clusters.json")
    print("  2. Review generated templates in: ./bootstrapped_templates/templates.json")
    print("  3. Run with real entity data (3,400+ entities)")
    print("  4. Enable BrightData MCP for real-world intelligence gathering")
    print("  5. Deploy to production for automatic entity classification")
    print()


if __name__ == "__main__":
    asyncio.run(test_bootstrap_pipeline())
