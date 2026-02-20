"""
Missed Signal Tracker

Tracks signals that SHOULD have been caught but weren't.
Identifies template gaps and triggers refinement cycles.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class MissedSignal:
    """Track a signal we should have caught"""
    entity_id: str
    signal_type: str
    signal_date: str
    discovered_date: str
    expected_discovery_date: str
    delay_days: int
    template_id: str
    missing_channel: str
    root_cause: str
    action_taken: str

    def to_dict(self) -> Dict:
        return asdict(self)


class MissedSignalTracker:
    """Track and analyze missed signals"""

    def __init__(self, graphiti_client=None):
        self.graphiti = graphiti_client
        self.missed_signals: List[MissedSignal] = []

    async def record_missed_signal(self, signal: MissedSignal):
        """
        Record a missed signal

        Args:
            signal: MissedSignal object
        """
        logger.info(f"🔴 Recording missed signal: {signal.entity_id} - {signal.signal_type}")

        self.missed_signals.append(signal)

        # Store in Graphiti if available
        if self.graphiti:
            try:
                await self.graphiti.create_missed_signal(signal.to_dict())
            except Exception as e:
                logger.error(f"Failed to store missed signal in Graphiti: {e}")

    async def calculate_missed_signal_rate(
        self,
        template_id: str,
        time_window: timedelta = timedelta(days=30)
    ) -> Dict:
        """
        Calculate missed signal rate for a template

        Args:
            template_id: Template ID to analyze
            time_window: Time window for analysis

        Returns:
            Statistics about missed signals
        """
        logger.info(f"📊 Calculating missed signal rate for: {template_id}")

        # Filter signals for template and time window
        cutoff_date = datetime.now() - time_window

        template_signals = [
            s for s in self.missed_signals
            if s.template_id == template_id
            and datetime.fromisoformat(s.signal_date) >= cutoff_date
        ]

        if not template_signals:
            return {
                "template_id": template_id,
                "time_window_days": time_window.days,
                "total_signals": 0,
                "caught_on_time": 0,
                "missed": 0,
                "missed_rate": 0.0,
                "avg_delay_days": 0.0,
                "top_missing_channels": [],
                "top_root_causes": []
            }

        # Calculate statistics
        missed = len(template_signals)
        avg_delay = sum(s.delay_days for s in template_signals) / missed

        # Count missing channels
        missing_channels = {}
        for signal in template_signals:
            missing_channels[signal.missing_channel] = \
                missing_channels.get(signal.missing_channel, 0) + 1

        top_missing_channels = sorted(
            missing_channels.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        # Count root causes
        root_causes = {}
        for signal in template_signals:
            root_causes[signal.root_cause] = \
                root_causes.get(signal.root_cause, 0) + 1

        top_root_causes = sorted(
            root_causes.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]

        # Estimate total signals (missed + caught)
        # Assuming 10% catch rate for missed signals
        total_signals = int(missed / 0.1)
        caught_on_time = total_signals - missed

        stats = {
            "template_id": template_id,
            "time_window_days": time_window.days,
            "total_signals": total_signals,
            "caught_on_time": caught_on_time,
            "missed": missed,
            "missed_rate": missed / total_signals if total_signals > 0 else 0.0,
            "avg_delay_days": round(avg_delay, 1),
            "top_missing_channels": [
                {"channel": c, "count": count}
                for c, count in top_missing_channels
            ],
            "top_root_causes": [
                {"cause": c, "count": count}
                for c, count in top_root_causes
            ]
        }

        logger.info(f"  - Missed rate: {stats['missed_rate']:.1%}")
        logger.info(f"  - Avg delay: {stats['avg_delay_days']:.1f} days")

        return stats

    async def analyze_template_gaps(
        self,
        template_id: str,
        time_window: timedelta = timedelta(days=30)
    ) -> Dict:
        """
        Analyze template gaps based on missed signals

        Returns:
            Recommendations for template refinement
        """
        logger.info(f"🔍 Analyzing template gaps: {template_id}")

        stats = await self.calculate_missed_signal_rate(
            template_id,
            time_window
        )

        recommendations = []

        # Check if missed rate is too high
        if stats['missed_rate'] > 0.15:  # >15% missed
            recommendations.append({
                "priority": "high",
                "issue": "High missed signal rate",
                "current_rate": f"{stats['missed_rate']:.1%}",
                "recommendation": "Add more signal channels or increase scraping frequency",
                "action": "expand_channels"
            })

        # Check missing channels
        for channel_info in stats['top_missing_channels']:
            if channel_info['count'] >= 3:  # 3+ misses in same channel
                recommendations.append({
                    "priority": "medium",
                    "issue": f"Frequent misses in {channel_info['channel']}",
                    "miss_count": channel_info['count'],
                    "recommendation": f"Add {channel_info['channel']} to template signal_channels",
                    "action": "add_channel"
                })

        # Check avg delay
        if stats['avg_delay_days'] > 7:  # >7 days delay
            recommendations.append({
                "priority": "high",
                "issue": "Slow detection (high delay)",
                "avg_delay_days": stats['avg_delay_days'],
                "recommendation": "Increase scraping frequency for high-priority channels",
                "action": "increase_frequency"
            })

        analysis = {
            "template_id": template_id,
            "statistics": stats,
            "recommendations": recommendations,
            "analyzed_at": datetime.now().isoformat(),
            "needs_refinement": len(recommendations) > 0
        }

        logger.info(f"  - Recommendations: {len(recommendations)}")

        return analysis

    async def generate_refinement_plan(
        self,
        template_id: str,
        template: Dict,
        time_window: timedelta = timedelta(days=30)
    ) -> Dict:
        """
        Generate a concrete refinement plan for a template

        Args:
            template_id: Template to refine
            template: Current template definition
            time_window: Analysis window

        Returns:
            Refinement plan with specific changes
        """
        logger.info(f"📋 Generating refinement plan: {template_id}")

        # Analyze gaps
        analysis = await self.analyze_template_gaps(template_id, time_window)

        refinement_plan = {
            "template_id": template_id,
            "current_version": template.get('version', 1),
            "target_version": template.get('version', 1) + 1,
            "changes": [],
            "estimated_impact": None,
            "created_at": datetime.now().isoformat()
        }

        # Process recommendations
        for rec in analysis['recommendations']:
            if rec['action'] == 'add_channel':
                # Add missing channel to template
                new_channel = {
                    "channel_type": rec['issue'].split('in ')[-1],
                    "signal_strength": "medium",
                    "scraping_priority": 0.6,
                    "update_frequency": "weekly",
                    "notes": f"Added due to {rec['miss_count']} missed signals"
                }

                refinement_plan['changes'].append({
                    "type": "add_channel",
                    "change": new_channel,
                    "reason": rec['recommendation']
                })

            elif rec['action'] == 'expand_channels':
                refinement_plan['changes'].append({
                    "type": "expand_channels",
                    "recommendation": "Review industry-specific channels for this cluster",
                    "reason": rec['issue']
                })

            elif rec['action'] == 'increase_frequency':
                # Find high-priority channels and increase frequency
                current_channels = template.get('signal_channels', [])
                high_priority_channels = [
                    c for c in current_channels
                    if c.get('scraping_priority', 0) >= 0.7
                ]

                for channel in high_priority_channels:
                    refinement_plan['changes'].append({
                        "type": "increase_frequency",
                        "channel_type": channel.get('channel_type'),
                        "old_frequency": channel.get('update_frequency'),
                        "new_frequency": "daily",
                        "reason": "Reduce detection delay for high-priority signals"
                    })

        # Estimate impact
        if refinement_plan['changes']:
            # Assume 20% reduction in missed rate per change
            current_missed_rate = analysis['statistics']['missed_rate']
            estimated_reduction = min(0.5, len(refinement_plan['changes']) * 0.2)
            new_missed_rate = current_missed_rate * (1 - estimated_reduction)

            refinement_plan['estimated_impact'] = {
                "current_missed_rate": current_missed_rate,
                "estimated_new_missed_rate": new_missed_rate,
                "improvement": f"{estimated_reduction:.1%}"
            }

        logger.info(f"  - Changes: {len(refinement_plan['changes'])}")

        return refinement_plan

    async def save_missed_signals_to_file(
        self,
        output_file: str = "data/missed_signals.json"
    ):
        """Save missed signals to file"""

        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "missed_signal_count": len(self.missed_signals)
            },
            "missed_signals": [
                signal.to_dict()
                for signal in self.missed_signals
            ]
        }

        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"💾 Saved {len(self.missed_signals)} missed signals to {output_file}")

    async def load_missed_signals_from_file(
        self,
        input_file: str = "data/missed_signals.json"
    ):
        """Load missed signals from file"""

        logger.info(f"📂 Loading missed signals from {input_file}...")

        with open(input_file, 'r') as f:
            data = json.load(f)

        self.missed_signals = [
            MissedSignal(**signal)
            for signal in data.get('missed_signals', [])
        ]

        logger.info(f"✅ Loaded {len(self.missed_signals)} missed signals")


async def main():
    """CLI for missed signal tracking"""

    import argparse

    parser = argparse.ArgumentParser(description="Track missed signals")
    parser.add_argument("--template-id", help="Template ID to analyze")
    parser.add_argument("--time-window-days", type=int, default=30, help="Analysis time window")
    parser.add_argument("--generate-plan", action="store_true", help="Generate refinement plan")
    parser.add_argument("--load-file", help="Load missed signals from file")
    parser.add_argument("--save-file", default="data/missed_signals.json", help="Save missed signals to file")

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    tracker = MissedSignalTracker()

    # Load missed signals if file provided
    if args.load_file:
        await tracker.load_missed_signals_from_file(args.load_file)

    # Analyze template if specified
    if args.template_id:
        time_window = timedelta(days=args.time_window_days)

        if args.generate_plan:
            # Load template (simplified)
            template = {"template_id": args.template_id, "version": 1}

            plan = await tracker.generate_refinement_plan(
                args.template_id,
                template,
                time_window
            )

            print(json.dumps(plan, indent=2))
        else:
            stats = await tracker.calculate_missed_signal_rate(
                args.template_id,
                time_window
            )

            print(json.dumps(stats, indent=2))

    # Save missed signals
    if tracker.missed_signals:
        await tracker.save_missed_signals_to_file(args.save_file)


if __name__ == "__main__":
    asyncio.run(main())
