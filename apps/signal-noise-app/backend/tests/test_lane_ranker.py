import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from lane_ranker import AdaptiveLaneRanker


def test_lane_ranker_prefers_higher_success_rate_with_decay():
    ranker = AdaptiveLaneRanker(decay=0.85, exploration_floor=0.05)

    for _ in range(6):
        ranker.record_outcome("search:google", outcome="hit", quality_score=0.8)
    for _ in range(6):
        ranker.record_outcome("search:bing", outcome="miss", quality_score=0.0)

    ranked = ranker.rank_lanes(["search:google", "search:bing"])
    assert ranked[0] == "search:google"


def test_lane_ranker_keeps_exploration_floor():
    ranker = AdaptiveLaneRanker(decay=0.9, exploration_floor=0.35)

    for _ in range(10):
        ranker.record_outcome("search:google", outcome="hit", quality_score=0.7)
        ranker.record_outcome("search:bing", outcome="hit", quality_score=0.65)

    ranked_with_scores = ranker.rank_with_scores(
        ["search:google", "search:bing", "search:yandex"]
    )
    score_map = dict(ranked_with_scores)

    assert score_map["search:yandex"] >= 0.35
