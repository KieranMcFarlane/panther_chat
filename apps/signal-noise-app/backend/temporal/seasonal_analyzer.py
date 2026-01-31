"""
Seasonality analysis for temporal patterns

Computes quarterly distribution from episode timestamps.
"""

from typing import Dict, List
from datetime import datetime


class SeasonalityAnalyzer:
    """Analyzes seasonal patterns in temporal episodes"""

    @staticmethod
    def compute_seasonality(episodes: List[Dict]) -> Dict[str, float]:
        """
        Compute quarter distribution from episode timestamps

        Args:
            episodes: List of episode dictionaries with timestamp field

        Returns:
            Dictionary with Q1-Q4 distribution (sums to 1.0)
        """
        quarters = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}

        for ep in episodes:
            # Try multiple timestamp field names
            timestamp = ep.get("timestamp") or ep.get("created_at") or ep.get("last_seen")

            if timestamp:
                try:
                    # Parse timestamp
                    if isinstance(timestamp, str):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    elif isinstance(timestamp, datetime):
                        dt = timestamp
                    else:
                        continue

                    # Determine quarter
                    month = dt.month
                    if month <= 3:
                        quarters["Q1"] += 1
                    elif month <= 6:
                        quarters["Q2"] += 1
                    elif month <= 9:
                        quarters["Q3"] += 1
                    else:
                        quarters["Q4"] += 1

                except (ValueError, AttributeError):
                    # Invalid timestamp, skip
                    continue

        # Normalize to distribution
        total = sum(quarters.values())

        if total == 0:
            # No valid data, return uniform distribution
            return {"Q1": 0.25, "Q2": 0.25, "Q3": 0.25, "Q4": 0.25}

        return {q: count / total for q, count in quarters.items()}

    @staticmethod
    def get_current_quarter(date: datetime = None) -> str:
        """
        Get current quarter as string

        Args:
            date: Date to check (defaults to now)

        Returns:
            Quarter string (Q1, Q2, Q3, Q4)
        """
        if date is None:
            date = datetime.now()

        month = date.month
        if month <= 3:
            return "Q1"
        elif month <= 6:
            return "Q2"
        elif month <= 9:
            return "Q3"
        else:
            return "Q4"
