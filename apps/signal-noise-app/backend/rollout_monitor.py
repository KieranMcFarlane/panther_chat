"""
Production Monitoring Dashboard for Rollout

Real-time metrics collection, aggregation, and alerting for
production rollout of hypothesis-driven discovery system.

Metrics tracked:
- Volume: entities processed, hypotheses tested, iterations
- Cost: total, avg per entity, avg per hypothesis
- Quality: actionable count, confidence distribution, promotion rate
- Performance: iterations, latency (avg, P95)
- Errors: rate, types
- Comparison: cost reduction, actionable increase vs old system

Part of Phase 6: Production Rollout
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from collections import Counter
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class MonitoringMetrics:
    """Production monitoring metrics"""
    # Volume metrics
    entities_processed: int = 0
    hypotheses_tested: int = 0
    total_iterations: int = 0

    # Cost metrics
    total_cost_usd: float = 0.0
    avg_cost_per_entity: float = 0.0
    avg_cost_per_hypothesis: float = 0.0

    # Quality metrics
    actionable_count: int = 0
    confidence_distribution: Dict[str, int] = field(default_factory=dict)
    promotion_rate: float = 0.0

    # Performance metrics
    avg_iterations: float = 0.0
    avg_latency_seconds: float = 0.0
    p95_latency_seconds: float = 0.0
    p99_latency_seconds: float = 0.0

    # Error metrics
    error_count: int = 0
    error_rate: float = 0.0
    error_types: Dict[str, int] = field(default_factory=dict)

    # Comparison metrics (vs old system)
    cost_reduction_vs_old: float = 0.0
    actionable_increase_vs_old: float = 0.0

    # Timestamp
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data


@dataclass
class AlertThresholds:
    """Alert threshold configuration"""
    max_error_rate_pct: float = 10.0
    max_avg_cost_usd: float = 1.0
    min_actionable_rate_pct: float = 30.0
    max_p95_latency_seconds: float = 30.0
    max_cost_increase_pct: float = 15.0
    min_actionable_increase_pct: float = 50.0


class RolloutMonitor:
    """
    Real-time monitoring for production rollout.

    Collects, aggregates, and analyzes metrics with alerting.
    """

    def __init__(
        self,
        log_file: str = "data/rollout_metrics.jsonl",
        alert_thresholds: AlertThresholds = None
    ):
        """
        Initialize rollout monitor.

        Args:
            log_file: Path to metrics log file
            alert_thresholds: Alert configuration
        """
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        self.alert_thresholds = alert_thresholds or AlertThresholds()
        self.metrics_buffer: List[Dict] = []
        self._lock = asyncio.Lock()

        logger.info(f"Initialized RolloutMonitor: log_file={log_file}")

    async def record_discovery(
        self,
        entity_id: str,
        result: Dict,
        old_system_result: Dict = None
    ) -> None:
        """
        Record discovery result with comparison.

        Args:
            entity_id: Entity identifier
            result: New system result
            old_system_result: Optional old system result for comparison
        """
        async with self._lock:
            # Extract metrics
            cost = result.get("total_cost_usd", 0.0)
            iterations = result.get("iterations", 0)
            actionable = result.get("actionable", False)
            confidence = result.get("final_confidence", 0.0)
            latency = result.get("duration_seconds", 0.0)
            error = result.get("error")

            # Build metrics entry
            entry = {
                "entity_id": entity_id,
                "timestamp": datetime.now().isoformat(),
                "cost_usd": cost,
                "iterations": iterations,
                "actionable": actionable,
                "confidence": confidence,
                "latency_seconds": latency,
                "error": str(error) if error else None
            }

            # Add comparison metrics if available
            if old_system_result:
                entry["old_cost_usd"] = old_system_result.get("total_cost_usd", 0.0)
                entry["old_actionable"] = old_system_result.get("actionable", False)

            # Add to buffer
            self.metrics_buffer.append(entry)

            # Write to log file
            await self._write_log_entry(entry)

    async def _write_log_entry(self, entry: Dict) -> None:
        """Write entry to log file"""
        try:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(entry) + '\n')

            # Rotate log file if too large (>10MB)
            if self.log_file.stat().st_size > 10 * 1024 * 1024:
                self._rotate_log_file()

        except Exception as e:
            logger.error(f"Failed to write log entry: {e}")

    def _rotate_log_file(self) -> None:
        """Rotate log file when size limit reached"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        rotated_path = self.log_file.parent / f"{self.log_file.stem}_{timestamp}.jsonl"

        self.log_file.rename(rotated_path)
        logger.info(f"Rotated log file to {rotated_path}")

    async def get_aggregate_metrics(
        self,
        time_window_minutes: int = 60
    ) -> MonitoringMetrics:
        """
        Get aggregated metrics over time window.

        Args:
            time_window_minutes: Minutes to look back

        Returns:
            MonitoringMetrics with aggregated data
        """
        async with self._lock:
            # Filter by time window
            cutoff_time = datetime.now() - timedelta(minutes=time_window_minutes)
            filtered = []

            for entry in self.metrics_buffer:
                entry_time = datetime.fromisoformat(entry["timestamp"])
                if entry_time >= cutoff_time:
                    filtered.append(entry)

            if not filtered:
                return MonitoringMetrics()

            # Calculate aggregates
            metrics = MonitoringMetrics()

            # Volume
            metrics.entities_processed = len(filtered)
            metrics.hypotheses_tested = sum(e.get("iterations", 0) for e in filtered)
            metrics.total_iterations = metrics.hypotheses_tested

            # Cost
            metrics.total_cost_usd = sum(e.get("cost_usd", 0.0) for e in filtered)
            metrics.avg_cost_per_entity = metrics.total_cost_usd / len(filtered) if filtered else 0.0
            metrics.avg_cost_per_hypothesis = (
                metrics.total_cost_usd / metrics.hypotheses_tested
                if metrics.hypotheses_tested > 0 else 0.0
            )

            # Quality
            metrics.actionable_count = sum(1 for e in filtered if e.get("actionable"))
            actionable_rate = (metrics.actionable_count / len(filtered)) * 100 if filtered else 0.0

            # Confidence distribution
            confidences = [e.get("confidence", 0.0) for e in filtered]
            metrics.confidence_distribution = self._bucket_confidences(confidences)
            metrics.promotion_rate = actionable_rate / 100.0

            # Performance
            latencies = [e.get("latency_seconds", 0.0) for e in filtered]
            if latencies:
                metrics.avg_latency_seconds = sum(latencies) / len(latencies)
                sorted_latencies = sorted(latencies)
                metrics.p95_latency_seconds = sorted_latencies[int(len(latencies) * 0.95)] if len(latencies) > 1 else 0.0
                metrics.p99_latency_seconds = sorted_latencies[int(len(latencies) * 0.99)] if len(latencies) > 1 else 0.0

            metrics.avg_iterations = (
                sum(e.get("iterations", 0) for e in filtered) / len(filtered)
                if filtered else 0.0
            )

            # Errors
            metrics.error_count = sum(1 for e in filtered if e.get("error"))
            metrics.error_rate = (metrics.error_count / len(filtered)) * 100 if filtered else 0.0

            error_types = [e.get("error", "Unknown") for e in filtered if e.get("error")]
            metrics.error_types = dict(Counter(error_types))

            # Comparison metrics (if old system data available)
            old_costs = [e.get("old_cost_usd", 0.0) for e in filtered if "old_cost_usd" in e]
            old_actionables = [e.get("old_actionable", False) for e in filtered if "old_actionable" in e]

            if old_costs:
                avg_old_cost = sum(old_costs) / len(old_costs)
                if avg_old_cost > 0:
                    cost_reduction = ((avg_old_cost - metrics.avg_cost_per_entity) / avg_old_cost) * 100
                    metrics.cost_reduction_vs_old = cost_reduction

            if old_actionables:
                old_actionable_rate = (sum(old_actionables) / len(old_actionables)) * 100
                if old_actionable_rate > 0:
                    actionable_increase = ((actionable_rate - old_actionable_rate) / old_actionable_rate) * 100
                    metrics.actionable_increase_vs_old = actionable_increase

            return metrics

    async def _check_alerts(self, metrics: MonitoringMetrics) -> List[str]:
        """
        Check alert thresholds and return warnings.

        Args:
            metrics: Current metrics

        Returns:
            List of alert messages
        """
        alerts = []

        # Check error rate
        if metrics.error_rate > self.alert_thresholds.max_error_rate_pct:
            alerts.append(
                f"ALERT: Error rate {metrics.error_rate:.1f}% exceeds threshold "
                f"{self.alert_thresholds.max_error_rate_pct:.1f}%"
            )

        # Check avg cost
        if metrics.avg_cost_per_entity > self.alert_thresholds.max_avg_cost_usd:
            alerts.append(
                f"ALERT: Avg cost ${metrics.avg_cost_per_entity:.2f} exceeds threshold "
                f"${self.alert_thresholds.max_avg_cost_usd:.2f}"
            )

        # Check actionable rate
        actionable_rate = (
            (metrics.actionable_count / metrics.entities_processed) * 100
            if metrics.entities_processed > 0 else 0
        )
        if actionable_rate < self.alert_thresholds.min_actionable_rate_pct:
            alerts.append(
                f"ALERT: Actionable rate {actionable_rate:.1f}% below threshold "
                f"{self.alert_thresholds.min_actionable_rate_pct:.1f}%"
            )

        # Check P95 latency
        if metrics.p95_latency_seconds > self.alert_thresholds.max_p95_latency_seconds:
            alerts.append(
                f"ALERT: P95 latency {metrics.p95_latency_seconds:.1f}s exceeds threshold "
                f"{self.alert_thresholds.max_p95_latency_seconds:.1f}s"
            )

        # Check cost increase vs old
        if metrics.cost_reduction_vs_old < -self.alert_thresholds.max_cost_increase_pct:
            alerts.append(
                f"ALERT: Cost increase {abs(metrics.cost_reduction_vs_old):.1f}% exceeds threshold "
                f"{self.alert_thresholds.max_cost_increase_pct:.1f}%"
            )

        # Check actionable increase vs old
        if metrics.actionable_increase_vs_old < self.alert_thresholds.min_actionable_increase_pct:
            alerts.append(
                f"ALERT: Actionable increase {metrics.actionable_increase_vs_old:.1f}% below threshold "
                f"{self.alert_thresholds.min_actionable_increase_pct:.1f}%"
            )

        return alerts

    def _bucket_confidences(self, confidences: List[float]) -> Dict[str, int]:
        """Bucket confidence values into ranges"""
        buckets = {
            "0.0-0.1": 0,
            "0.1-0.2": 0,
            "0.2-0.3": 0,
            "0.3-0.4": 0,
            "0.4-0.5": 0,
            "0.5-0.6": 0,
            "0.6-0.7": 0,
            "0.7-0.8": 0,
            "0.8-0.9": 0,
            "0.9-1.0": 0,
        }

        for conf in confidences:
            bucket_key = f"{int(conf * 10) / 10:.1f}-{int(conf * 10) / 10 + 0.1:.1f}"
            if bucket_key in buckets:
                buckets[bucket_key] += 1

        return {k: v for k, v in buckets.items() if v > 0}  # Remove empty buckets

    async def start_monitoring_loop(
        self,
        interval_seconds: int = 60,
        alert_callback: callable = None
    ) -> None:
        """
        Start background monitoring loop.

        Args:
            interval_seconds: How often to check metrics
            alert_callback: Optional async function to call on alerts
        """
        logger.info(f"Starting monitoring loop: interval={interval_seconds}s")

        while True:
            try:
                # Get metrics
                metrics = await self.get_aggregate_metrics(time_window_minutes=60)

                # Check alerts
                alerts = await self._check_alerts(metrics)

                if alerts:
                    logger.warning(f"Alerts triggered: {alerts}")

                    if alert_callback:
                        await alert_callback(metrics, alerts)

                # Wait for next interval
                await asyncio.sleep(interval_seconds)

            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retry

    async def export_report(self, format: str = "markdown") -> str:
        """
        Export metrics as report.

        Args:
            format: Report format ("markdown", "json", "html")

        Returns:
            Report string
        """
        # Get current metrics
        metrics = await self.get_aggregate_metrics(time_window_minutes=60)

        if format == "json":
            return json.dumps(metrics.to_dict(), indent=2)

        elif format == "markdown":
            report = f"""# Rollout Monitoring Report

**Generated:** {metrics.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

## Volume Metrics
- Entities Processed: {metrics.entities_processed}
- Hypotheses Tested: {metrics.hypotheses_tested}
- Total Iterations: {metrics.total_iterations}

## Cost Metrics
- Total Cost: ${metrics.total_cost_usd:.2f}
- Avg Cost per Entity: ${metrics.avg_cost_per_entity:.4f}
- Avg Cost per Hypothesis: ${metrics.avg_cost_per_hypothesis:.4f}

## Quality Metrics
- Actionable Count: {metrics.actionable_count} ({(metrics.actionable_count / metrics.entities_processed * 100) if metrics.entities_processed > 0 else 0:.1f}%)
- Promotion Rate: {metrics.promotion_rate:.2%}

### Confidence Distribution
{self._format_confidence_distribution(metrics.confidence_distribution)}

## Performance Metrics
- Avg Iterations: {metrics.avg_iterations:.1f}
- Avg Latency: {metrics.avg_latency_seconds:.2f}s
- P95 Latency: {metrics.p95_latency_seconds:.2f}s
- P99 Latency: {metrics.p99_latency_seconds:.2f}s

## Error Metrics
- Error Count: {metrics.error_count}
- Error Rate: {metrics.error_rate:.2f}%

### Error Types
{self._format_error_types(metrics.error_types)}

## Comparison Metrics (vs Old System)
- Cost Reduction: {metrics.cost_reduction_vs_old:+.1f}%
- Actionable Increase: {metrics.actionable_increase_vs_old:+.1f}%
"""
            return report

        elif format == "html":
            # Simple HTML report
            return f"""<html>
<head><title>Rollout Report</title></head>
<body>
<h1>Rollout Monitoring Report</h1>
<p><strong>Generated:</strong> {metrics.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</p>
<h2>Metrics</h2>
<pre>{json.dumps(metrics.to_dict(), indent=2)}</pre>
</body>
</html>"""

        else:
            raise ValueError(f"Unknown format: {format}")

    def _format_confidence_distribution(self, distribution: Dict) -> str:
        """Format confidence distribution for report"""
        if not distribution:
            return "No data"

        lines = []
        for bucket, count in sorted(distribution.items()):
            bar = "█" * (count // 5)  # Simple bar chart
            lines.append(f"- {bucket}: {count} {bar}")

        return "\n".join(lines)

    def _format_error_types(self, error_types: Dict) -> str:
        """Format error types for report"""
        if not error_types:
            return "No errors"

        lines = []
        for error_type, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
            lines.append(f"- {error_type}: {count}")

        return "\n".join(lines)


async def print_metrics_summary(monitor: RolloutMonitor) -> None:
    """
    Print current metrics summary to console.

    Args:
        monitor: RolloutMonitor instance
    """
    metrics = await monitor.get_aggregate_metrics(time_window_minutes=60)

    print("\n=== Rollout Metrics Summary ===")
    print(f"Entities: {metrics.entities_processed}")
    print(f"Total Cost: ${metrics.total_cost_usd:.2f}")
    print(f"Avg Cost/Entity: ${metrics.avg_cost_per_entity:.4f}")
    print(f"Actionable: {metrics.actionable_count} ({(metrics.actionable_count / metrics.entities_processed * 100) if metrics.entities_processed > 0 else 0:.1f}%)")
    print(f"Error Rate: {metrics.error_rate:.2f}%")
    print(f"Avg Latency: {metrics.avg_latency_seconds:.2f}s")
    print(f"P95 Latency: {metrics.p95_latency_seconds:.2f}s")
    print(f"Cost Reduction: {metrics.cost_reduction_vs_old:+.1f}%")
    print(f"Actionable Increase: {metrics.actionable_increase_vs_old:+.1f}%")
    print("=" + "\n")


async def alert_handler(metrics: MonitoringMetrics, alerts: List[str]) -> None:
    """
    Example alert handler callback.

    Args:
        metrics: Current metrics
        alerts: List of alert messages
    """
    for alert in alerts:
        print(f"🚨 {alert}")

    # In production, this would send to Slack, email, etc.
    # Example:
    # await send_slack_alert("\n".join(alerts))
    # await send_email_alert("\n".join(alerts))
