"""
Signal Extraction Agent for MVP Thin Vertical Slice

Extracts structured signals from unstructured content using Claude Agent SDK.

MVP Scope:
- 3 signal types only (RFP_DETECTED, EXECUTIVE_CHANGE, PARTNERSHIP_FORMED)
- Fixed canonical taxonomy (no dynamic types)
- Confidence scoring (0-1)
- Evidence citations required
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import json

logger = logging.getLogger(__name__)


# Canonical Signal Taxonomy (Fixed for MVP)
CANONICAL_SIGNAL_TYPES = [
    "RFP_DETECTED",
    "EXECUTIVE_CHANGE",
    "PARTNERSHIP_FORMED"
]


@dataclass
class ExtractedSignal:
    """Structured signal extracted from content"""
    signal_type: str  # One of CANONICAL_SIGNAL_TYPES
    entity_id: str
    content: str
    confidence: float  # 0-1
    evidence: List[str]  # Citations from source
    metadata: Dict[str, Any]
    extracted_at: datetime


class SignalExtractor:
    """
    Signal Extraction Agent using Claude Agent SDK

    MVP Implementation:
    - Extracts 3 signal types only
    - Fixed taxonomy (no dynamic types)
    - Requires confidence score
    - Requires evidence citations

    Usage:
        extractor = SignalExtractor(claude_client)
        signals = await extractor.extract_signals(
            content="AC Milan just hired a new CTO...",
            entity_id="ac_milan",
            source_url="https://..."
        )
    """

    def __init__(self, claude_client=None):
        """
        Initialize signal extractor

        Args:
            claude_client: ClaudeClient instance (from claude_client.py)
        """
        self.claude = claude_client

    async def extract_signals(
        self,
        content: str,
        entity_id: str,
        source_url: str = None,
        entity_name: str = None
    ) -> List[ExtractedSignal]:
        """
        Extract structured signals from content

        MVP: Uses Claude to identify signals from fixed taxonomy

        Args:
            content: Unstructured text content (article, post, etc.)
            entity_id: Entity identifier
            source_url: Source URL for citation
            entity_name: Human-readable entity name

        Returns:
            List of ExtractedSignal objects
        """
        if not self.claude:
            # Fallback: Return mock signals for MVP testing
            return self._extract_mock_signals(content, entity_id, source_url)

        # Build extraction prompt
        prompt = self._build_extraction_prompt(
            content, entity_id, entity_name
        )

        try:
            # Invoke Claude for signal extraction
            response = await self.claude.query(
                prompt=prompt,
                context=self._build_extraction_context()
            )

            # Parse Claude response into signals
            signals = self._parse_extraction_response(
                response, entity_id, source_url
            )

            # Validate signals
            valid_signals = self._validate_signals(signals)

            logger.info(f"Extracted {len(valid_signals)} signals from {entity_id}")
            return valid_signals

        except Exception as e:
            logger.error(f"Error extracting signals from {entity_id}: {e}")
            return []

    def _build_extraction_prompt(
        self,
        content: str,
        entity_id: str,
        entity_name: str = None
    ) -> str:
        """Build prompt for Claude signal extraction"""
        entity_display = entity_name or entity_id.replace('_', ' ').title()

        return f"""Extract structured signals from the following content about {entity_display}.

Content:
{content}

Available Signal Types (ONLY use these):
1. RFP_DETECTED - Organization issued or is planning to issue a Request for Proposal
2. EXECUTIVE_CHANGE - C-level executives, VPs, or Directors joined/left/changed roles
3. PARTNERSHIP_FORMED - Organization formed a new partnership or collaboration

For each signal detected:
- Assign signal type (MUST be from the 3 types above)
- Provide confidence score (0.0 to 1.0, where 1.0 is certain)
- Extract supporting evidence (direct quotes or paraphrases from content)
- Include relevant metadata (names, dates, amounts, etc.)

Output Format (JSON):
{{
  "signals": [
    {{
      "signal_type": "EXECUTIVE_CHANGE",
      "content": "AC Milan appointed John Doe as new CTO",
      "confidence": 0.9,
      "evidence": ["appointed John Doe as new CTO"],
      "metadata": {{
        "role": "CTO",
        "person": "John Doe",
        "action": "appointed"
      }}
    }}
  ]
}}

Rules:
- ONLY emit signals from the 3 approved types
- If evidence is weak, assign LOW confidence rather than hallucinating
- If no signal is present, return empty signals array: {{"signals": []}}
- NEVER invent signal types not in the approved list
"""

    def _build_extraction_context(self) -> str:
        """Build context for signal extraction"""
        return """You are a Signal Extraction Agent.

Your task is to identify structured signals from unstructured content.

HARD CONSTRAINTS:
- You MAY ONLY use these 3 signal types: RFP_DETECTED, EXECUTIVE_CHANGE, PARTNERSHIP_FORMED
- You MUST provide confidence scores (0-1)
- You MUST cite evidence from the content
- When in doubt, assign LOW confidence
- False negatives are better than false positives

Output valid JSON only."""

    def _parse_extraction_response(
        self,
        response: str,
        entity_id: str,
        source_url: str
    ) -> List[ExtractedSignal]:
        """Parse Claude response into ExtractedSignal objects"""
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1

            if json_start == -1 or json_end == 0:
                logger.warning("No JSON found in Claude response")
                return []

            json_str = response[json_start:json_end]
            data = json.loads(json_str)

            signals = []
            for signal_data in data.get('signals', []):
                signal = ExtractedSignal(
                    signal_type=signal_data.get('signal_type'),
                    entity_id=entity_id,
                    content=signal_data.get('content', ''),
                    confidence=float(signal_data.get('confidence', 0.5)),
                    evidence=signal_data.get('evidence', []),
                    metadata=signal_data.get('metadata', {}),
                    extracted_at=datetime.now(timezone.utc)
                )
                signals.append(signal)

            return signals

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Claude response: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing extraction response: {e}")
            return []

    def _validate_signals(self, signals: List[ExtractedSignal]) -> List[ExtractedSignal]:
        """
        Validate extracted signals

        MVP Validation:
        - Signal type must be in canonical taxonomy
        - Confidence must be 0-1
        - Evidence must not be empty
        """
        valid_signals = []

        for signal in signals:
            # Validate signal type
            if signal.signal_type not in CANONICAL_SIGNAL_TYPES:
                logger.warning(
                    f"Rejected signal with invalid type: {signal.signal_type}. "
                    f"Must be one of {CANONICAL_SIGNAL_TYPES}"
                )
                continue

            # Validate confidence
            if not 0 <= signal.confidence <= 1:
                logger.warning(f"Rejected signal with invalid confidence: {signal.confidence}")
                continue

            # Validate evidence
            if not signal.evidence:
                logger.warning("Rejected signal with no evidence")
                continue

            # Signal is valid
            valid_signals.append(signal)

        return valid_signals

    def _extract_mock_signals(
        self,
        content: str,
        entity_id: str,
        source_url: str = None
    ) -> List[ExtractedSignal]:
        """
        Extract mock signals for MVP testing (without Claude)

        Returns predetermined signals based on content keywords
        """
        import random

        content_lower = content.lower()
        signals = []

        # Check for RFP keywords
        rfp_keywords = ['rfp', 'request for proposal', 'tender', 'procurement']
        if any(kw in content_lower for kw in rfp_keywords):
            signals.append(ExtractedSignal(
                signal_type="RFP_DETECTED",
                entity_id=entity_id,
                content=f"RFP detected in content about {entity_id}",
                confidence=0.8,
                evidence=["Content contains RFP-related keywords"],
                metadata={"detection_method": "keyword_match"},
                extracted_at=datetime.now(timezone.utc)
            ))

        # Check for executive change keywords
        exec_keywords = ['appointed', 'hired', 'left', 'resigned', 'new cto', 'new ceo']
        if any(kw in content_lower for kw in exec_keywords):
            signals.append(ExtractedSignal(
                signal_type="EXECUTIVE_CHANGE",
                entity_id=entity_id,
                content=f"Executive change detected for {entity_id}",
                confidence=0.75,
                evidence=["Content contains executive change keywords"],
                metadata={"detection_method": "keyword_match"},
                extracted_at=datetime.now(timezone.utc)
            ))

        # Check for partnership keywords
        partner_keywords = ['partnered', 'collaboration', 'joint venture', 'strategic alliance']
        if any(kw in content_lower for kw in partner_keywords):
            signals.append(ExtractedSignal(
                signal_type="PARTNERSHIP_FORMED",
                entity_id=entity_id,
                content=f"Partnership detected for {entity_id}",
                confidence=0.7,
                evidence=["Content contains partnership keywords"],
                metadata={"detection_method": "keyword_match"},
                extracted_at=datetime.now(timezone.utc)
            ))

        return signals


def get_canonical_signal_types() -> List[str]:
    """Get list of canonical signal types"""
    return CANONICAL_SIGNAL_TYPES.copy()


def is_valid_signal_type(signal_type: str) -> bool:
    """Check if signal type is valid"""
    return signal_type in CANONICAL_SIGNAL_TYPES
