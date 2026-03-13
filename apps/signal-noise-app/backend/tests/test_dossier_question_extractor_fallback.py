#!/usr/bin/env python3

import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_question_extractor import DossierQuestionExtractor
from schemas import DossierSection


class _FakeClaude:
    async def query(self, *args, **kwargs):
        return {
            "content": "Action plan:\n- validate profile fields\n- gather evidence from official channels",
            "model_used": "haiku",
        }


@pytest.mark.asyncio
async def test_question_extractor_uses_template_fallback_when_ai_returns_no_questions():
    extractor = DossierQuestionExtractor(_FakeClaude())
    section = DossierSection(
        id="quick_actions",
        title="Immediate action recommendations",
        content=[
            "Prioritize procurement timeline mapping and budget window visibility.",
            "Improve stakeholder outreach preparation.",
        ],
    )

    questions = await extractor.extract_questions_from_section(
        section=section,
        entity_name="FIBA",
        max_questions=3,
    )

    assert len(questions) >= 1
    assert all(q.question_text.endswith("?") for q in questions)
    assert any("FIBA" in q.question_text for q in questions)
