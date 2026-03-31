from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_and_write_default_inventory
from question_pack_pruner import build_and_write_default_review_pack
from question_pack_business_reasoner import build_business_goal_reasoned_pack


def test_build_business_goal_reasoned_pack_ranks_high_signal_questions_above_noisy_context():
    inventory_path = build_and_write_default_inventory(BACKEND_DIR)
    review_pack_path = build_and_write_default_review_pack(inventory_path)

    business_pack = build_business_goal_reasoned_pack(review_pack_path)
    questions = business_pack["business_goal_reasoned_pack"]["questions"]

    digital_question = next(
        item
        for item in questions
        if item["question"] == "What evidence in the last 180 days shows {entity} is pursuing digital transformation, legacy replacement, or a new vendor search?"
    )
    competitor_question = next(
        item
        for item in questions
        if item["question"] == "How does this compare to top competitors?"
    )

    assert business_pack["summary"]["business_goal_question_count"] == 68
    assert len(questions) == 68
    assert digital_question["business_goal_score"] > competitor_question["business_goal_score"]
    assert digital_question["business_goal_bucket"] == "direct_revenue_signal"
    assert competitor_question["business_goal_bucket"] in {"context_support", "weak_signal"}
    assert questions == sorted(questions, key=lambda item: item["business_goal_score"], reverse=True)
