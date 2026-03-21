#!/usr/bin/env python3

import pytest

from dossier_question_extractor import DossierQuestionExtractor
from schemas import DossierSection


class MockClaudeQuestionClient:
    async def query(self, prompt: str, model: str = "haiku", max_tokens: int = 500):
        # Deliberately prose-like output (not strict question lines)
        return {
            "content": "1. Map current decision-maker ownership\n2. Identify procurement timing window\n3. Confirm platform migration scope"
        }


@pytest.mark.asyncio
async def test_question_extractor_template_fallback_when_ai_output_not_question_lines():
    extractor = DossierQuestionExtractor(claude_client=MockClaudeQuestionClient())
    section = DossierSection(
        id="leadership",
        title="Leadership",
        content=[
            "Key contacts listed without explicit question marks.",
            "Need better clarity on role ownership and buying committee."
        ],
    )

    questions = await extractor.extract_questions_from_section(
        section=section,
        entity_name="FIBA",
        max_questions=3,
    )

    assert len(questions) >= 1
    assert all(q.question_text.endswith("?") for q in questions)
