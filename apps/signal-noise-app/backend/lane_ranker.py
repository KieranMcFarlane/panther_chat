#!/usr/bin/env python3
"""Adaptive ranking for search lanes with decayed outcomes and exploration floor."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


@dataclass
class LaneStats:
    weighted_observations: float = 0.0
    weighted_successes: float = 0.0
    weighted_quality: float = 0.0
    total_observations: int = 0
    hits: int = 0
    misses: int = 0
    timeouts: int = 0
    errors: int = 0


class AdaptiveLaneRanker:
    """Prioritize lanes that keep succeeding while preserving exploration."""

    def __init__(
        self,
        *,
        decay: float = 0.9,
        exploration_floor: float = 0.2,
        uncertainty_weight: float = 0.15,
    ) -> None:
        self.decay = min(max(float(decay), 0.01), 0.999)
        self.exploration_floor = min(max(float(exploration_floor), 0.0), 1.0)
        self.uncertainty_weight = max(float(uncertainty_weight), 0.0)
        self._stats: Dict[str, LaneStats] = {}

    def _clamp01(self, value: float) -> float:
        return min(max(float(value), 0.0), 1.0)

    def record_outcome(self, lane: str, *, outcome: str, quality_score: float = 0.0) -> None:
        lane_key = str(lane or "").strip()
        if not lane_key:
            return

        normalized_outcome = str(outcome or "").strip().lower() or "miss"
        stats = self._stats.setdefault(lane_key, LaneStats())

        success_signal = 1.0 if normalized_outcome == "hit" else 0.0
        quality_signal = self._clamp01(quality_score) if normalized_outcome == "hit" else 0.0

        stats.weighted_observations = (stats.weighted_observations * self.decay) + 1.0
        stats.weighted_successes = (stats.weighted_successes * self.decay) + success_signal
        stats.weighted_quality = (stats.weighted_quality * self.decay) + quality_signal
        stats.total_observations += 1

        if normalized_outcome == "hit":
            stats.hits += 1
        elif normalized_outcome == "timeout":
            stats.timeouts += 1
        elif normalized_outcome == "error":
            stats.errors += 1
        else:
            stats.misses += 1

    def _score_lane(self, lane: str, total_weight: float) -> float:
        stats = self._stats.get(lane)
        if not stats or stats.weighted_observations <= 0:
            return self.exploration_floor

        success_rate = stats.weighted_successes / stats.weighted_observations
        quality_rate = stats.weighted_quality / stats.weighted_observations
        exploitation = (0.7 * success_rate) + (0.3 * quality_rate)
        exploration_bonus = math.sqrt(
            math.log(max(total_weight, 1.0) + 1.0) / (stats.weighted_observations + 1.0)
        )
        return max(self.exploration_floor, exploitation + (self.uncertainty_weight * exploration_bonus))

    def rank_with_scores(self, lanes: Iterable[str]) -> List[Tuple[str, float]]:
        deduped_lanes: List[str] = []
        seen = set()
        for lane in lanes:
            lane_key = str(lane or "").strip()
            if not lane_key or lane_key in seen:
                continue
            deduped_lanes.append(lane_key)
            seen.add(lane_key)

        if not deduped_lanes:
            return []

        total_weight = sum(stats.weighted_observations for stats in self._stats.values())
        indexed_scores = []
        for index, lane in enumerate(deduped_lanes):
            score = self._score_lane(lane, total_weight)
            indexed_scores.append((lane, score, index))

        indexed_scores.sort(key=lambda item: (-item[1], item[2]))
        return [(lane, score) for lane, score, _ in indexed_scores]

    def rank_lanes(self, lanes: Iterable[str]) -> List[str]:
        return [lane for lane, _ in self.rank_with_scores(lanes)]

    def snapshot(self) -> Dict[str, object]:
        lanes = self.rank_with_scores(self._stats.keys())
        lane_payload: Dict[str, Dict[str, float | int]] = {}
        total_weight = sum(stats.weighted_observations for stats in self._stats.values())

        for lane, score in lanes:
            stats = self._stats[lane]
            observations = max(stats.weighted_observations, 1e-9)
            lane_payload[lane] = {
                "score": round(score, 4),
                "weighted_observations": round(stats.weighted_observations, 4),
                "success_rate": round(stats.weighted_successes / observations, 4),
                "quality_rate": round(stats.weighted_quality / observations, 4),
                "total_observations": stats.total_observations,
                "hits": stats.hits,
                "misses": stats.misses,
                "timeouts": stats.timeouts,
                "errors": stats.errors,
            }

        return {
            "decay": self.decay,
            "exploration_floor": self.exploration_floor,
            "uncertainty_weight": self.uncertainty_weight,
            "total_weighted_observations": round(total_weight, 4),
            "lanes": lane_payload,
        }
