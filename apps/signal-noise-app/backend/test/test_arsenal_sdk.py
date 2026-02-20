#!/usr/bin/env python3
"""
Test Arsenal FC with REAL Claude API (using Anthropic SDK)

Usage:
    cd backend
    python test/test_arsenal_sdk.py

Requirements:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
"""
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List

from anthropic import Anthropic

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def test_arsenal_with_sdk():
    """Test Arsenal FC validation with real Claude API using SDK"""

    print("\n" + "="*80)
    print("🧪 ARSENAL FC VALIDATION TEST (REAL CLAUDE API - SDK)")
    print("="*80 + "\n")

    # Check API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ERROR: ANTHROPIC_API_KEY not set!")
        print("\nSet it with:")
        print("  export ANTHROPIC_API_KEY=sk-ant-...")
        return 1

    print(f"✅ API key found: {api_key[:10]}...{api_key[-4:]}")
    print("   WARNING: This will make REAL API calls and cost money!")
    print()

    # Initialize Anthropic client
    client = Anthropic(api_key=api_key)

    # Create webhook signal
    webhook_signal = {
        "id": "webhook-linkedin-20260128-000015",
        "type": "RFP_DETECTED",
        "confidence": 0.92,
        "entity_id": "arsenal_fc",
        "evidence": [
            {
                "source": "LinkedIn",
                "credibility_score": 0.85,
                "url": "https://linkedin.com/jobs/view/123456789",
                "date": "2026-01-28",
                "text": "Arsenal FC seeking Head of Digital Transformation"
            }
        ]
    }

    # Add enrichment (simulate what Ralph Loop Pass 1 does)
    webhook_signal['evidence'].append({
        'source': 'Graphiti corroboration',
        'credibility_score': 0.75,
        'related_signal_id': 'arsenal-rfp-20260115',
        'date': '2026-01-15'
    })

    webhook_signal['evidence'].append({
        'source': 'Perplexity',
        'credibility_score': 0.70,
        'date': '2026-01-28'
    })

    logger.info(f"📨 Signal: {webhook_signal['id']}")
    logger.info(f"   Type: {webhook_signal['type']}")
    logger.info(f"   Original Confidence: {webhook_signal['confidence']}")
    logger.info(f"   Evidence: {len(webhook_signal['evidence'])} items (after enrichment)")

    # Build prompt for Claude
    evidence_text = "\n".join([
        f"{i+1}. {ev['source']} (credibility: {ev['credibility_score']})"
        for i, ev in enumerate(webhook_signal['evidence'])
    ])

    prompt = f"""You are a signal validation expert. Validate this signal for entity: arsenal_fc

Signal:
- ID: {webhook_signal['id']}
- Type: {webhook_signal['type']}
- Confidence: {webhook_signal['confidence']}

Evidence:
{evidence_text}

Task: Validate signal and adjust confidence if needed.

Consider:
1. Evidence quality (credibility, recency, source diversity)
2. Confidence score alignment with evidence strength
3. Adjustment range: ±0.15

Confidence Scoring Guidelines:
- 0.9-1.0: Multiple high-credibility sources (0.8+), official statements
- 0.7-0.9: Multiple credible sources (0.6+), strong indicators
- 0.5-0.7: Mixed credibility, some ambiguity
- 0.3-0.5: Single sources, low credibility
- 0.0-0.3: Rumors, unverified

Return ONLY a JSON object (no markdown, no explanation):
{{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "brief explanation",
  "requires_manual_review": false
}}

Be concise but thorough."""

    # Call Claude API with Haiku
    print("\n" + "-"*80)
    print("CALLING CLAUDE API (Haiku)")
    print("-"*80 + "\n")

    start_time = datetime.now(timezone.utc)

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()

        # Extract response
        content = response.content[0].text
        logger.info(f"✅ Claude response received")
        logger.info(f"   Processing time: {processing_time:.2f}s")

        # Parse JSON response
        import re
        json_match = re.search(r'\{[^}]*"validated"[^}]*\}', content, re.DOTALL)

        if json_match:
            result = json.loads(json_match.group(0))

            # Calculate token usage and cost
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            total_tokens = input_tokens + output_tokens

            # Haiku costs $0.25 per million tokens
            cost = total_tokens * 0.25 / 1_000_000

            original_confidence = webhook_signal['confidence']
            adjustment = result.get('confidence_adjustment', 0.0)
            validated_confidence = original_confidence + adjustment

            # Display results
            print("\n" + "-"*80)
            print("RESULTS (REAL CLAUDE API)")
            print("-"*80 + "\n")

            print(f"✅ Signal Validated Successfully!\n")
            print(f"   Signal ID: {webhook_signal['id']}")
            print(f"   Type: {webhook_signal['type']}")
            print(f"   Original Confidence: {original_confidence:.2f}")
            print(f"   Validated Confidence: {validated_confidence:.2f}")
            print(f"   Confidence Adjustment: {adjustment:+.2f}")
            print(f"\n   Model: claude-3-5-haiku-20241022")
            print(f"   Input Tokens: {input_tokens:,}")
            print(f"   Output Tokens: {output_tokens:,}")
            print(f"   Total Tokens: {total_tokens:,}")
            print(f"   Cost: ${cost:.4f}")
            print(f"   Processing Time: {processing_time:.2f}s")
            print(f"\n   Validation Result:")
            print(f"   Validated: {result.get('validated')}")
            print(f"   Rationale: {result.get('rationale', 'N/A')}")
            print(f"   Manual Review: {result.get('requires_manual_review', False)}")

            # Cost comparison
            sonnet_cost = total_tokens * 3.0 / 1_000_000
            savings = sonnet_cost - cost
            savings_pct = (savings / sonnet_cost) * 100 if sonnet_cost > 0 else 0

            print(f"\n💰 Cost Comparison:")
            print(f"   Sonnet (if used): ${sonnet_cost:.4f}")
            print(f"   Haiku (actual): ${cost:.4f}")
            print(f"   Savings: ${savings:.4f} ({savings_pct:.1f}%)")

            print("\n" + "-"*80)
            print("✅ TEST COMPLETE - REAL API CALL SUCCESSFUL")
            print("="*80 + "\n")

            return 0

        else:
            print(f"\n❌ Could not parse JSON from Claude response")
            print(f"\nRaw response:\n{content}\n")
            return 1

    except Exception as e:
        logger.error(f"❌ Claude API call failed: {e}", exc_info=True)
        print(f"\n❌ Error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_arsenal_with_sdk())
    sys.exit(exit_code)
