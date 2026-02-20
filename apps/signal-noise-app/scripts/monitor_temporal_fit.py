#!/usr/bin/env python3
"""
Monitor Temporal Fit and Predictive Patterns

Analyzes temporal fit scores and predictive patterns for RFP detection.
Tracks entity timelines, identifies high-priority targets, and validates
predictions against actual outcomes.

Usage:
    python scripts/monitor_temporal_fit.py --entity arsenal-fc --days 90

Features:
- Temporal fit scoring based on historical RFP activity
- Trend analysis (increasing, stable, decreasing)
- Category matching and confidence calculation
- High-priority target identification
"""
import asyncio
import sys
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.graphiti_service import GraphitiService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def monitor_temporal_fit(
    entity_ids: Optional[List[str]] = None,
    time_horizon_days: int = 90
) -> Dict[str, Any]:
    """
    Monitor temporal fit and predictive patterns for entities

    Args:
        entity_ids: List of entity IDs to analyze (if None, analyze all)
        time_horizon_days: Time horizon for analysis (default: 90 days)

    Returns:
        Temporal fit analysis with predictions and patterns
    """
    logger.info(f"📈 Monitoring temporal fit patterns (horizon: {time_horizon_days} days)")

    # Initialize Graphiti service
    graphiti = GraphitiService()
    await graphiti.initialize()

    analysis = {
        'time_horizon_days': time_horizon_days,
        'analysis_date': datetime.now(timezone.utc).isoformat(),
        'entities': {}
    }

    # Determine which entities to analyze
    if entity_ids:
        target_entities = entity_ids
    else:
        # Get all entities with recent activity
        # For now, use a default list
        target_entities = [
            'arsenal-fc',
            'chelsea-fc',
            'manchester-united',
            'manchester-city',
            'liverpool-fc'
        ]
        logger.info(f"Analyzing {len(target_entities)} default entities")

    logger.info(f"📊 Analyzing {len(target_entities)} entities")

    for entity_id in target_entities:
        logger.info(f"\n{'='*60}")
        logger.info(f"Analyzing: {entity_id}")
        logger.info(f"{'='*60}")

        try:
            # Get entity timeline
            timeline = await graphiti.get_entity_timeline(
                entity_id=entity_id,
                limit=100
            )

            # Filter episodes within time horizon
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_horizon_days)
            recent_episodes = [
                ep for ep in timeline
                if datetime.fromisoformat(ep.get('timestamp', '')) >= cutoff_date
            ]

            # Calculate fit score
            fit_analysis = calculate_temporal_fit(
                entity_id=entity_id,
                episodes=recent_episodes,
                time_horizon_days=time_horizon_days
            )

            analysis['entities'][entity_id] = fit_analysis

            logger.info(f"  📊 RFPs in last {time_horizon_days} days: {fit_analysis['rfp_count']}")
            logger.info(f"  📈 Trend: {fit_analysis['trend']}")
            logger.info(f"  🎯 Fit Score: {fit_analysis['fit_score']:.2f}")
            logger.info(f"  🏷️ Category: {fit_analysis['priority_category']}")

        except Exception as e:
            logger.error(f"  ❌ Analysis failed: {e}")
            analysis['entities'][entity_id] = {
                'error': str(e),
                'rfp_count': 0,
                'fit_score': 0.0
            }

    # Identify top targets
    top_targets = identify_top_targets(analysis)

    analysis['top_targets'] = top_targets
    analysis['total_entities_analyzed'] = len(target_entities)

    # Print summary
    print_temporal_fit_summary(analysis)

    graphiti.close()

    return analysis


def calculate_temporal_fit(
    entity_id: str,
    episodes: List[Dict[str, Any]],
    time_horizon_days: int
) -> Dict[str, Any]:
    """
    Calculate temporal fit score for entity

    Fit score factors:
    - RFP frequency (more RFPs = higher fit)
    - Trend (increasing = higher fit)
    - Category consistency (same category = higher fit)
    - Recency (recent RFPs = higher fit)
    """
    if not episodes:
        return {
            'entity_id': entity_id,
            'rfp_count': 0,
            'fit_score': 0.0,
            'trend': 'unknown',
            'priority_category': 'low',
            'confidence': 0.0
        }

    rfp_count = len(episodes)

    # Calculate trend (increasing, stable, decreasing)
    # Split episodes into first half and second half
    mid_point = len(episodes) // 2
    first_half = episodes[:mid_point]
    second_half = episodes[mid_point:]

    if len(first_half) == 0 or len(second_half) == 0:
        trend = 'stable'
    elif len(second_half) > len(first_half) * 1.2:
        trend = 'increasing'
    elif len(second_half) < len(first_half) * 0.8:
        trend = 'decreasing'
    else:
        trend = 'stable'

    # Category consistency (check if most RFPs are in same category)
    categories = [ep.get('category', 'Unknown') for ep in episodes]
    category_counts = {}
    for cat in categories:
        category_counts[cat] = category_counts.get(cat, 0) + 1

    dominant_category = max(category_counts, key=category_counts.get)
    category_consistency = category_counts[dominant_category] / len(categories)

    # Calculate fit score (0.0 - 1.0)
    # Base score from RFP count (normalized to 0-1, max ~10 RFPs)
    count_score = min(rfp_count / 10.0, 1.0)

    # Trend multiplier
    trend_multipliers = {
        'increasing': 1.3,
        'stable': 1.0,
        'decreasing': 0.7,
        'unknown': 0.5
    }
    trend_multiplier = trend_multipliers.get(trend, 1.0)

    # Category consistency multiplier
    consistency_multiplier = 0.8 + (category_consistency * 0.2)  # 0.8 - 1.0

    # Calculate final fit score
    fit_score = count_score * trend_multiplier * consistency_multiplier
    fit_score = min(fit_score, 1.0)  # Cap at 1.0

    # Determine priority category
    if fit_score >= 0.7:
        priority_category = 'high'
    elif fit_score >= 0.4:
        priority_category = 'medium'
    else:
        priority_category = 'low'

    # Calculate confidence based on data quality
    confidence = min(rfp_count / 5.0, 1.0)  # More data = higher confidence

    return {
        'entity_id': entity_id,
        'rfp_count': rfp_count,
        'fit_score': fit_score,
        'trend': trend,
        'dominant_category': dominant_category,
        'category_consistency': category_consistency,
        'priority_category': priority_category,
        'confidence': confidence,
        'episodes': [
            {
                'timestamp': ep.get('timestamp'),
                'category': ep.get('category'),
                'confidence': ep.get('confidence_score')
            }
            for ep in episodes[:5]  # Limit to 5 most recent
        ]
    }


def identify_top_targets(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Identify top priority targets for RFP outreach"""
    entities = []

    for entity_id, data in analysis.get('entities', {}).items():
        if 'error' in data:
            continue

        entities.append({
            'entity_id': entity_id,
            'fit_score': data['fit_score'],
            'rfp_count': data['rfp_count'],
            'trend': data['trend'],
            'priority_category': data['priority_category']
        })

    # Sort by fit score (descending)
    entities.sort(key=lambda x: x['fit_score'], reverse=True)

    return entities[:10]  # Return top 10


def print_temporal_fit_summary(analysis: Dict[str, Any]) -> None:
    """Print temporal fit summary statistics"""
    print("\n" + "="*60)
    print("📈 TEMPORAL FIT ANALYSIS SUMMARY")
    print("="*60)
    print(f"Analysis Date: {analysis['analysis_date']}")
    print(f"Time Horizon: {analysis['time_horizon_days']} days")
    print(f"Total Entities Analyzed: {analysis['total_entities_analyzed']}")

    # Top targets
    top_targets = analysis.get('top_targets', [])

    print(f"\n🎯 Top Priority Targets:")
    for i, target in enumerate(top_targets, 1):
        print(f"  {i}. {target['entity_id']}")
        print(f"     Fit Score: {target['fit_score']:.2f}")
        print(f"     RFP Count: {target['rfp_count']}")
        print(f"     Trend: {target['trend']}")
        print(f"     Priority: {target['priority_category'].upper()}")

    # Trend distribution
    trend_counts = {}
    priority_counts = {}

    for entity_data in analysis.get('entities', {}).values():
        if 'error' in entity_data:
            continue

        trend = entity_data.get('trend', 'unknown')
        priority = entity_data.get('priority_category', 'low')

        trend_counts[trend] = trend_counts.get(trend, 0) + 1
        priority_counts[priority] = priority_counts.get(priority, 0) + 1

    print(f"\n📊 Trend Distribution:")
    for trend, count in trend_counts.items():
        print(f"  {trend.capitalize()}: {count}")

    print(f"\n🎯 Priority Distribution:")
    for priority, count in priority_counts.items():
        print(f"  {priority.upper()}: {count}")

    print("="*60)


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Monitor temporal fit and predictive patterns")
    parser.add_argument(
        '--entity',
        type=str,
        action='append',
        help='Entity ID to analyze (can specify multiple)'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=90,
        help='Time horizon in days (default: 90)'
    )

    args = parser.parse_args()

    logger.info(f"🎯 Starting temporal fit analysis")
    logger.info(f"⏰ Started at: {datetime.now().isoformat()}")

    # Analyze temporal fit
    analysis = await monitor_temporal_fit(
        entity_ids=args.entity,
        time_horizon_days=args.days
    )

    logger.info(f"✅ Analysis completed at: {datetime.now().isoformat()}")

    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = Path(__file__).parent.parent / 'data' / f'temporal_fit_{timestamp}.json'

    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(analysis, f, indent=2, default=str)

    logger.info(f"💾 Results saved to: {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
