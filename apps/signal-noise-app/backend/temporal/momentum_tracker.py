"""
Momentum tracking for temporal patterns

Tracks recent activity trends to identify emerging patterns.
"""

from typing import Dict, List
from datetime import datetime, timedelta, timezone


class MomentumTracker:
    """Tracks momentum indicators for temporal episodes"""

    @staticmethod
    def compute_momentum(
        episodes: List[Dict],
        reference_date: datetime = None
    ) -> Dict[str, int]:
        """
        Compute momentum counts for multiple time windows

        Args:
            episodes: List of episode dictionaries with timestamp field
            reference_date: Reference date (defaults to now, timezone-aware)

        Returns:
            Dictionary with counts for various time windows
        """
        if reference_date is None:
            reference_date = datetime.now(timezone.utc)

        # Define time windows
        windows = {
            "30d": 30,
            "60d": 60,
            "90d": 90,
            "180d": 180,
            "365d": 365
        }

        counts = {window: 0 for window in windows}

        for ep in episodes:
            timestamp = ep.get("timestamp") or ep.get("created_at") or ep.get("last_seen")

            if timestamp:
                try:
                    if isinstance(timestamp, str):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    elif isinstance(timestamp, datetime):
                        dt = timestamp
                    else:
                        continue

                    # Ensure both datetimes are timezone-aware or both naive
                    if reference_date.tzinfo is not None and dt.tzinfo is None:
                        # Make dt timezone-aware
                        dt = dt.replace(tzinfo=timezone.utc)
                    elif reference_date.tzinfo is None and dt.tzinfo is not None:
                        # Make reference_date timezone-aware
                        reference_date = reference_date.replace(tzinfo=timezone.utc)

                    # Check each time window
                    days_ago = (reference_date - dt).days

                    for window, threshold in windows.items():
                        if days_ago <= threshold:
                            counts[window] += 1

                except (ValueError, AttributeError):
                    continue

        return counts

    @staticmethod
    def get_momentum_30d(episodes: List[Dict], reference_date: datetime = None) -> int:
        """Get count of episodes in last 30 days"""
        return MomentumTracker.compute_momentum(episodes, reference_date)["30d"]

    @staticmethod
    def get_momentum_90d(episodes: List[Dict], reference_date: datetime = None) -> int:
        """Get count of episodes in last 90 days"""
        return MomentumTracker.compute_momentum(episodes, reference_date)["90d"]

    @staticmethod
    def compute_trend(episodes: List[Dict], reference_date: datetime = None) -> str:
        """
        Compute trend direction based on recent activity

        Args:
            episodes: List of episode dictionaries
            reference_date: Reference date (defaults to now)

        Returns:
            Trend string: "increasing", "stable", "decreasing", "unknown"
        """
        momentum = MomentumTracker.compute_momentum(episodes, reference_date)

        # Compare recent vs older periods
        recent_30 = momentum["30d"]
        previous_30 = momentum["60d"] - momentum["30d"]

        if recent_30 == 0 and previous_30 == 0:
            return "unknown"

        if recent_30 > previous_30 * 1.2:
            return "increasing"
        elif recent_30 < previous_30 * 0.8:
            return "decreasing"
        else:
            return "stable"

    @staticmethod
    def get_velocity_score(episodes: List[Dict], reference_date: datetime = None) -> float:
        """
        Get velocity score (normalized activity rate)

        Args:
            episodes: List of episode dictionaries
            reference_date: Reference date (defaults to now)

        Returns:
            Velocity score from 0.0 (no activity) to 1.0 (high activity)
        """
        momentum = MomentumTracker.compute_momentum(episodes, reference_date)

        # Normalize to [0, 1] based on typical ranges
        # 5+ events in 30 days is very high velocity
        # 0 events is zero velocity
        recent_30 = momentum["30d"]
        velocity = min(1.0, recent_30 / 5.0)

        return velocity
