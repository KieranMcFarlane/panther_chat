#!/usr/bin/env python3
"""
Monitor Rollout Script

Real-time monitoring dashboard for hypothesis-driven discovery rollout.

Displays live metrics, alerts, and performance indicators during
staged rollout execution.

Usage:
    python scripts/monitor_rollout.py
    python scripts/monitor_rollout.py --metrics-file data/rollout_metrics.jsonl
    python scripts/monitor_rollout.py --refresh 5 --alert-threshold-error 15
"""

import asyncio
import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.rollout_monitor import RolloutMonitor, MonitoringMetrics

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RolloutDashboard:
    """
    Real-time monitoring dashboard for rollout metrics

    Features:
    - Live metrics display
    - Alert detection and display
    - Historical trends
    - Export capabilities
    """

    def __init__(
        self,
        metrics_file: str = "data/rollout_metrics.jsonl",
        refresh_interval_seconds: int = 10,
        alert_thresholds: Dict[str, float] = None
    ):
        """
        Initialize dashboard

        Args:
            metrics_file: Path to metrics log file
            refresh_interval_seconds: How often to refresh display
            alert_thresholds: Custom alert thresholds
        """
        self.metrics_file = Path(metrics_file)
        self.refresh_interval = refresh_interval_seconds

        # Default alert thresholds
        self.alert_thresholds = alert_thresholds or {
            "error_rate": 10.0,
            "avg_cost_per_entity": 1.00,
            "actionable_rate": 30.0,
            "p95_latency_seconds": 30.0
        }

        self.monitor = RolloutMonitor(log_file=metrics_file)
        self.running = False

        logger.info(f"Dashboard initialized: {metrics_file}")
        logger.info(f"Refresh interval: {refresh_interval_seconds}s")

    async def display_metrics(self, metrics: MonitoringMetrics):
        """
        Display current metrics in formatted output

        Args:
            metrics: Current metrics to display
        """
        # Clear screen (platform-dependent)
        import os
        os.system('cls' if os.name == 'nt' else 'clear')

        print("=" * 80)
        print("HYPOTHESIS-DRIVEN DISCOVERY ROLLOUT MONITOR")
        print("=" * 80)
        print(f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()

        # Volume Metrics
        print("📊 VOLUME METRICS")
        print("-" * 80)
        print(f"  Entities Processed:     {metrics.entities_processed:,}")
        print(f"  Hypotheses Tested:       {metrics.hypotheses_tested:,}")
        print(f"  Total Iterations:        {metrics.total_iterations:,}")
        print()

        # Cost Metrics
        print("💰 COST METRICS")
        print("-" * 80)
        print(f"  Total Cost:              ${metrics.total_cost_usd:.2f}")
        print(f"  Avg Cost Per Entity:     ${metrics.avg_cost_per_entity:.4f}")
        print(f"  Avg Cost Per Hypothesis: ${metrics.avg_cost_per_hypothesis:.4f}")
        if metrics.cost_reduction_vs_old != 0:
            reduction_color = "✅" if metrics.cost_reduction_vs_old > 0 else "❌"
            print(f"  Cost Reduction vs Old:   {reduction_color} {metrics.cost_reduction_vs_old:+.1f}%")
        print()

        # Quality Metrics
        print("🎯 QUALITY METRICS")
        print("-" * 80)
        print(f"  Actionable Count:        {metrics.actionable_count:,}")
        actionable_rate = (metrics.actionable_count / metrics.entities_processed * 100) if metrics.entities_processed > 0 else 0.0
        print(f"  Actionable Rate:         {actionable_rate:.1f}%")
        if metrics.actionable_increase_vs_old != 0:
            increase_color = "✅" if metrics.actionable_increase_vs_old > 0 else "❌"
            print(f"  Actionable Increase vs Old: {increase_color} {metrics.actionable_increase_vs_old:+.1f}%")
        print()

        # Confidence Distribution
        if metrics.confidence_distribution:
            print("  Confidence Distribution:")
            for range_label, count in sorted(metrics.confidence_distribution.items()):
                bar_length = min(50, int(count / max(metrics.confidence_distribution.values()) * 50))
                bar = "█" * bar_length
                print(f"    {range_label}: {bar} ({count})")
        print()

        # Performance Metrics
        print("⚡ PERFORMANCE METRICS")
        print("-" * 80)
        print(f"  Avg Iterations:          {metrics.avg_iterations:.1f}")
        print(f"  Avg Latency:             {metrics.avg_latency_seconds:.2f}s")
        print(f"  P95 Latency:             {metrics.p95_latency_seconds:.2f}s")
        print()

        # Error Metrics
        print("⚠️  ERROR METRICS")
        print("-" * 80)
        print(f"  Error Count:             {metrics.error_count:,}")
        print(f"  Error Rate:              {metrics.error_rate:.2f}%")

        if metrics.error_types:
            print("  Error Types:")
            for error_type, count in sorted(metrics.error_types.items(), key=lambda x: -x[1]):
                print(f"    - {error_type}: {count}")
        print()

        # Alerts
        alerts = self._check_alerts(metrics)
        if alerts:
            print("🚨 ALERTS")
            print("-" * 80)
            for alert in alerts:
                print(f"  ❌ {alert}")
            print()

        print("=" * 80)
        print("Press Ctrl+C to exit | Refreshing every {} seconds...".format(
            self.refresh_interval
        ))
        print()

    def _check_alerts(self, metrics: MonitoringMetrics) -> List[str]:
        """
        Check metrics against alert thresholds

        Args:
            metrics: Current metrics

        Returns:
            List of alert messages
        """
        alerts = []

        # Error rate alert
        if metrics.error_rate > self.alert_thresholds.get("error_rate", 10.0):
            alerts.append(
                f"Error rate ({metrics.error_rate:.1f}%) exceeds threshold "
                f"({self.alert_thresholds['error_rate']:.1f}%)"
            )

        # Cost alert
        if metrics.avg_cost_per_entity > self.alert_thresholds.get("avg_cost_per_entity", 1.00):
            alerts.append(
                f"Avg cost per entity (${metrics.avg_cost_per_entity:.2f}) exceeds threshold "
                f"(${self.alert_thresholds['avg_cost_per_entity']:.2f})"
            )

        # Actionable rate alert
        actionable_rate = (metrics.actionable_count / metrics.entities_processed * 100) if metrics.entities_processed > 0 else 0.0
        if metrics.entities_processed > 0 and actionable_rate < self.alert_thresholds.get("actionable_rate", 30.0):
            alerts.append(
                f"Actionable rate ({actionable_rate:.1f}%) below threshold "
                f"({self.alert_thresholds['actionable_rate']:.1f}%)"
            )

        # Latency alert
        if metrics.p95_latency_seconds > self.alert_thresholds.get("p95_latency_seconds", 30.0):
            alerts.append(
                f"P95 latency ({metrics.p95_latency_seconds:.1f}s) exceeds threshold "
                f"({self.alert_thresholds['p95_latency_seconds']:.1f}s)"
            )

        return alerts

    async def run(self):
        """
        Run monitoring dashboard with periodic refresh

        Continuously monitors metrics file and updates display.
        """
        self.running = True
        logger.info("Starting monitoring dashboard...")

        try:
            while self.running:
                # Get latest metrics
                time_window_minutes = 60  # Last hour
                metrics = await self.monitor.get_aggregate_metrics(time_window_minutes)

                # Display metrics
                await self.display_metrics(metrics)

                # Wait for refresh interval
                await asyncio.sleep(self.refresh_interval)

        except KeyboardInterrupt:
            logger.info("\nDashboard stopped by user")
            self.running = False

        except Exception as e:
            logger.error(f"Dashboard error: {e}")
            self.running = False
            raise

    async def export_snapshot(self, output_path: str = None):
        """
        Export current metrics snapshot to file

        Args:
            output_path: Optional output file path (default: data/rollout_snapshot_*.json)
        """
        metrics = await self.monitor.get_aggregate_metrics(time_window_minutes=60)

        if not output_path:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f"data/rollout_snapshot_{timestamp}.json"

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(metrics.__dict__, f, indent=2, default=str)

        logger.info(f"Snapshot exported to {output_path}")


async def print_metrics_summary(monitor: RolloutMonitor):
    """
    Print metrics summary to console

    Args:
        monitor: RolloutMonitor instance
    """
    metrics = await monitor.get_aggregate_metrics(time_window_minutes=60)

    print("\n" + "=" * 80)
    print("METRICS SUMMARY (Last 60 minutes)")
    print("=" * 80)
    print(f"Entities: {metrics.entities_processed:,}")
    print(f"Cost: ${metrics.total_cost_usd:.2f}")
    print(f"Actionable: {metrics.actionable_count:,} ({metrics.actionable_count/metrics.entities_processed*100:.1f}%)")
    print(f"Errors: {metrics.error_count} ({metrics.error_rate:.2f}%)")
    print("=" * 80 + "\n")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Monitor rollout metrics")
    parser.add_argument(
        "--metrics-file",
        type=str,
        default="data/rollout_metrics.jsonl",
        help="Path to metrics log file"
    )
    parser.add_argument(
        "--refresh",
        type=int,
        default=10,
        help="Refresh interval in seconds (default: 10)"
    )
    parser.add_argument(
        "--snapshot",
        action="store_true",
        help="Export snapshot and exit (don't run dashboard)"
    )
    parser.add_argument(
        "--snapshot-output",
        type=str,
        help="Snapshot output file path"
    )
    parser.add_argument(
        "--alert-threshold-error",
        type=float,
        default=10.0,
        help="Error rate alert threshold in %% (default: 10.0)"
    )
    parser.add_argument(
        "--alert-threshold-cost",
        type=float,
        default=1.00,
        help="Cost per entity alert threshold in USD (default: 1.00)"
    )
    parser.add_argument(
        "--alert-threshold-actionable",
        type=float,
        default=30.0,
        help="Actionable rate alert threshold in %% (default: 30.0)"
    )
    parser.add_argument(
        "--alert-threshold-latency",
        type=float,
        default=30.0,
        help="P95 latency alert threshold in seconds (default: 30.0)"
    )

    args = parser.parse_args()

    # Build alert thresholds
    alert_thresholds = {
        "error_rate": args.alert_threshold_error,
        "avg_cost_per_entity": args.alert_threshold_cost,
        "actionable_rate": args.alert_threshold_actionable,
        "p95_latency_seconds": args.alert_threshold_latency
    }

    # Initialize dashboard
    dashboard = RolloutDashboard(
        metrics_file=args.metrics_file,
        refresh_interval_seconds=args.refresh,
        alert_thresholds=alert_thresholds
    )

    if args.snapshot:
        # Export snapshot only
        await dashboard.export_snapshot(args.snapshot_output)
    else:
        # Run interactive dashboard
        await dashboard.run()


if __name__ == "__main__":
    asyncio.run(main())
