from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dossier_publication_quality import apply_publication_quality_gates


def test_publication_gate_demotes_nested_publication_statuses():
    dossier = {
        "publish_status": "published",
        "publication_status": "published",
        "question_first": {
            "publish_status": "published",
            "publication_status": "published",
            "discovery_summary": {
                "graphiti_sales_brief": None,
                "yellow_panther_fit": None,
                "outreach_strategy": None,
            },
        },
        "metadata": {
            "question_first": {
                "publish_status": "published",
                "publication_status": "published",
            },
        },
        "executive_summary": {},
        "strategic_analysis": {},
        "sections": {},
    }

    gated = apply_publication_quality_gates(dossier)

    assert gated["publish_status"] == "published_partial"
    assert gated["publication_status"] == "published_partial"
    assert gated["question_first"]["publish_status"] == "published_partial"
    assert gated["question_first"]["publication_status"] == "published_partial"
    assert gated["metadata"]["question_first"]["publish_status"] == "published_partial"
    assert gated["metadata"]["question_first"]["publication_status"] == "published_partial"
