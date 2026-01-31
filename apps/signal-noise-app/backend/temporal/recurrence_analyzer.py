"""
Recurrence analysis for temporal patterns

Detects timing intervals and computes bell curve statistics.
"""

from typing import Tuple, List, Optional, Dict
from datetime import datetime, timedelta


class RecurrenceAnalyzer:
    """Analyzes recurrence patterns in temporal episodes"""

    @staticmethod
    def compute_recurrence(episodes: List[Dict]) -> Tuple[Optional[float], Optional[float]]:
        """
        Compute mean and std of intervals between episodes

        Args:
            episodes: List of episode dictionaries with timestamp field

        Returns:
            Tuple of (mean_days, std_days) or (None, None) if insufficient data
        """
        if len(episodes) < 2:
            return None, None

        timestamps = []

        # Extract and parse timestamps
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

                    timestamps.append(dt)

                except (ValueError, AttributeError):
                    continue

        # Need at least 2 valid timestamps
        if len(timestamps) < 2:
            return None, None

        # Sort timestamps
        timestamps.sort()

        # Compute intervals between consecutive events
        intervals = []
        for i in range(1, len(timestamps)):
            delta = timestamps[i] - timestamps[i-1]
            intervals.append(delta.days)

        if not intervals:
            return None, None

        # Compute mean
        mean_interval = sum(intervals) / len(intervals)

        # Compute standard deviation
        variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
        std_interval = variance ** 0.5

        return mean_interval, std_interval

    @staticmethod
    def get_days_since_last(episodes: List[Dict], reference_date: datetime = None) -> Optional[int]:
        """
        Get days since the most recent episode

        Args:
            episodes: List of episode dictionaries
            reference_date: Reference date (defaults to now)

        Returns:
            Days since last episode or None if no valid episodes
        """
        if reference_date is None:
            reference_date = datetime.now()

        latest_timestamp = None

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

                    if latest_timestamp is None or dt > latest_timestamp:
                        latest_timestamp = dt

                except (ValueError, AttributeError):
                    continue

        if latest_timestamp is None:
            return None

        delta = reference_date - latest_timestamp
        return delta.days

    @staticmethod
    def is_due_for_event(
        episodes: List[Dict],
        reference_date: datetime = None,
        std_threshold: float = 1.5
    ) -> Tuple[bool, Optional[float]]:
        """
        Check if an entity is due for another event based on recurrence

        Args:
            episodes: List of episode dictionaries
            reference_date: Reference date (defaults to now)
            std_threshold: How many stds beyond mean to trigger "due" status

        Returns:
            Tuple of (is_due, confidence_score)
        """
        mean, std = RecurrenceAnalyzer.compute_recurrence(episodes)

        if mean is None or std is None or std == 0:
            return False, None

        days_since = RecurrenceAnalyzer.get_days_since_last(episodes, reference_date)

        if days_since is None:
            return False, None

        # Compute z-score
        z_score = (days_since - mean) / std

        # Due if we're >= std_threshold standard deviations beyond mean
        is_due = z_score >= std_threshold

        # Confidence based on how far beyond mean we are
        confidence = min(1.0, z_score / std_threshold)

        return is_due, confidence
