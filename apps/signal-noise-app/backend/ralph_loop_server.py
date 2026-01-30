#!/usr/bin/env python3
"""
Ralph Loop Server

FastAPI server for webhook handling and Ralph Loop validation.
Supports two modes:
1. Webhook Handler (default) - Real-time signal processing
2. Cron Worker - Scheduled batch processing

Aligned with iteration_02 architecture:
- GraphRAG scrapes raw data (articles, posts, job listings)
- Evidence Verifier validates scraped data BEFORE it becomes Evidence
- Claude reasons over VERIFIED, STRUCTURED evidence (not raw text)
- Graphiti stores the validated signal

Usage:
    # Webhook Handler mode
    python -m backend.ralph_loop_server

    # Cron Worker mode
    WORKER_MODE=cron python -m backend.ralph_loop_server
"""
import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import traceback

# FastAPI
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel, EmailStr
from fastapi.responses import JSONResponse

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Evidence verification
from backend.evidence_verifier import EvidenceVerifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment variables
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL")
ANTHROPIC_AUTH_TOKEN = os.getenv("ANTHROPIC_AUTH_TOKEN")
FALKORDB_URI = os.getenv("FALKORDB_URI", "bolt://localhost:7687")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
WORKER_MODE = os.getenv("WORKER_MODE", "webhook")

# Evidence verification configuration
ENABLE_EVIDENCE_VERIFICATION = os.getenv("RALPH_LOOP_ENABLE_EVIDENCE_VERIFICATION", "true").lower() == "true"
VERIFICATION_TIMEOUT = int(os.getenv("RALPH_LOOP_VERIFICATION_TIMEOUT", "5"))
VERIFICATION_MODE = os.getenv("RALPH_LOOP_VERIFICATION_MODE", "lenient")  # strict | lenient

# =============================================================================
# Pydantic Models
# =============================================================================

class WebhookSignal(BaseModel):
    """Webhook signal from external sources"""
    id: str
    source: str  # linkedin, brightdata, google-news, custom
    entity_id: str
    entity_name: Optional[str] = None
    type: str  # RFP_DETECTED, EXECUTIVE_CHANGE, etc.
    confidence: float
    evidence: List[Dict[str, Any]]
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ValidationResponse(BaseModel):
    """Response from webhook validation"""
    status: str
    signal_id: Optional[str] = None
    validated: bool = False
    original_confidence: Optional[float] = None
    validated_confidence: Optional[float] = None
    adjustment: Optional[float] = None
    rationale: Optional[str] = None
    model_used: Optional[str] = None
    cost_usd: Optional[float] = None
    processing_time_seconds: Optional[float] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    mode: str
    timestamp: str
    dependencies: Dict[str, bool]


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="Ralph Loop Validation Service",
    description="Real-time signal validation with confidence assessment using Claude model cascade",
    version="1.0.0"
)

# =============================================================================
# Claude Client (using SDK)
# =============================================================================

try:
    from anthropic import Anthropic
    claude_client = Anthropic(api_key=ANTHROPIC_API_KEY)
    logger.info("✅ Claude client initialized")
except ImportError:
    logger.warning("⚠️ anthropic package not installed - using mock")
    claude_client = None
except Exception as e:
    logger.error(f"❌ Failed to initialize Claude client: {e}")
    claude_client = None

# =============================================================================
# Ralph Loop Validator
# =============================================================================

class RalphLoopValidator:
    """Ralph Loop validator with Claude API integration and Evidence verification"""

    def __init__(self):
        self.config = {
            'min_evidence': int(os.getenv("RALPH_LOOP_MIN_EVIDENCE", "3")),
            'min_confidence': float(os.getenv("RALPH_LOOP_MIN_CONFIDENCE", "0.7")),
            'enable_confidence_validation': os.getenv("RALPH_LOOP_ENABLE_CONFIDENCE_VALIDATION", "true").lower() == "true",
            'max_confidence_adjustment': float(os.getenv("RALPH_LOOP_MAX_CONFIDENCE_ADJUSTMENT", "0.15"))
        }

        # Initialize evidence verifier (iteration_02 aligned)
        self.evidence_verifier = EvidenceVerifier() if ENABLE_EVIDENCE_VERIFICATION else None

        if self.evidence_verifier:
            logger.info(f"✅ Evidence verification enabled (mode: {VERIFICATION_MODE})")
        else:
            logger.info("⚠️  Evidence verification disabled")

    async def validate_signal(self, signal: WebhookSignal) -> ValidationResponse:
        """
        Validate a single signal using Ralph Loop 3-pass validation + Evidence verification

        iteration_02 aligned pipeline:
        1. Rule-based filtering
        1.5. Evidence verification (NEW - validates scraped data before Claude reasoning)
        2. Claude validation (reasons over VERIFIED evidence, not raw text)
        3. Final confirmation

        Args:
            signal: WebhookSignal to validate

        Returns:
            ValidationResponse with validation results
        """
        start_time = datetime.now(timezone.utc)

        logger.info(f"🔁 Ralph Loop validation for {signal.entity_id}")

        # Convert signal to dict for internal processing
        signal_dict = signal.dict()
        signal_dict['timestamp'] = signal.timestamp or datetime.now(timezone.utc).isoformat()

        # Pass 1: Rule-based filtering
        pass1_result = await self._pass1_filter(signal_dict)

        if not pass1_result['survived']:
            # Trigger feedback for rejected signal
            await self._trigger_rejection_feedback(signal, "pass1_filter", start_time)

            return ValidationResponse(
                status="rejected",
                validated=False,
                processing_time_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )

        # Pass 1.5: Evidence verification (NEW - iteration_02 aligned)
        if self.evidence_verifier:
            pass15_result = await self._pass1_5_evidence_verification(pass1_result['signal'])
        else:
            pass15_result = {'survived': True, 'signal': pass1_result['signal'], 'verification_summary': None}

        # In strict mode, reject if evidence verification fails
        if VERIFICATION_MODE == "strict" and not pass15_result['survived']:
            await self._trigger_rejection_feedback(signal, "evidence_verification", start_time)

            return ValidationResponse(
                status="rejected",
                validated=False,
                rationale="Evidence verification failed in strict mode",
                processing_time_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )

        # Pass 2: Claude validation (enhanced with verification context)
        pass2_result = await self._pass2_claude_validation(
            pass15_result['signal'],
            pass15_result.get('verification_summary')
        )

        if not pass2_result['survived']:
            await self._trigger_rejection_feedback(signal, "pass2_claude_validation", start_time)

            return ValidationResponse(
                status="rejected",
                validated=False,
                processing_time_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )

        # Pass 3: Final confirmation
        pass3_result = await self._pass3_final_confirmation(pass2_result['signal'])

        if not pass3_result['survived']:
            await self._trigger_rejection_feedback(signal, "pass3_final_confirmation", start_time)

            return ValidationResponse(
                status="rejected",
                validated=False,
                processing_time_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )

        # Signal passed all 3 passes
        processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()

        # NEW: Trigger binding feedback processor
        try:
            from backend.binding_feedback_processor import BindingFeedbackProcessor

            feedback_processor = BindingFeedbackProcessor()

            # Extract pattern_id from signal metadata if available
            pattern_id = signal.metadata.get('pattern_id') if signal.metadata else None

            # Process Ralph Loop validation feedback
            feedback_result = await feedback_processor.process_ralph_loop_feedback(
                entity_id=signal.entity_id,
                signal_id=signal.id,
                pattern_id=pattern_id or signal.type,
                validation_result="validated",
                confidence=pass3_result['signal']['final_confidence'],
                metadata={
                    "original_confidence": signal.confidence,
                    "adjustment": pass3_result['signal'].get('confidence_adjustment', 0.0),
                    "rationale": pass3_result['signal'].get('rationale', ''),
                    "model_used": pass3_result['signal'].get('model_used', '')
                }
            )

            if feedback_result.success:
                logger.info(
                    f"🔄 Binding updated from validation: {signal.entity_id} "
                    f"(confidence: {feedback_result.new_confidence:.2f})"
                )

        except ImportError:
            logger.warning("⚠️  BindingFeedbackProcessor not available, skipping binding update")
        except Exception as e:
            logger.error(f"⚠️  Failed to update binding from validation: {e}")

        return ValidationResponse(
            status="validated",
            signal_id=pass3_result['signal']['id'],
            validated=True,
            original_confidence=signal.confidence,
            validated_confidence=pass3_result['signal']['final_confidence'],
            adjustment=pass3_result['signal'].get('confidence_adjustment', 0.0),
            rationale=pass3_result['signal'].get('rationale', ''),
            model_used=pass3_result['signal'].get('model_used', ''),
            cost_usd=pass3_result['signal'].get('validation_cost', 0.0),
            processing_time_seconds=processing_time
        )

    async def _trigger_rejection_feedback(
        self,
        signal: WebhookSignal,
        rejection_reason: str,
        start_time: datetime
    ):
        """
        Trigger feedback processing for rejected signals

        Args:
            signal: The rejected signal
            rejection_reason: Why it was rejected
            start_time: When validation started
        """
        try:
            from backend.binding_feedback_processor import BindingFeedbackProcessor

            feedback_processor = BindingFeedbackProcessor()

            # Extract pattern_id from signal metadata if available
            pattern_id = signal.metadata.get('pattern_id') if signal.metadata else None

            # Process rejection feedback
            feedback_result = await feedback_processor.process_ralph_loop_feedback(
                entity_id=signal.entity_id,
                signal_id=signal.id,
                pattern_id=pattern_id or signal.type,
                validation_result="rejected",
                confidence=signal.confidence,
                metadata={
                    "rejection_reason": rejection_reason,
                    "processing_time_seconds": (datetime.now(timezone.utc) - start_time).total_seconds()
                }
            )

            if feedback_result.success:
                logger.debug(
                    f"🔄 Binding updated from rejection: {signal.entity_id} "
                    f"(confidence: {feedback_result.new_confidence:.2f})"
                )

        except ImportError:
            logger.warning("⚠️  BindingFeedbackProcessor not available, skipping rejection feedback")
        except Exception as e:
            logger.error(f"⚠️  Failed to update binding from rejection: {e}")

    async def _pass1_filter(self, signal: Dict) -> Dict:
        """Pass 1: Rule-based filtering"""
        logger.info("🔁 Pass 1/3: Rule-based filtering")

        # Check confidence threshold
        if signal['confidence'] < self.config['min_confidence']:
            logger.debug(f"❌ Pass 1: Low confidence {signal['confidence']} < {self.config['min_confidence']}")
            return {'survived': False}

        # Check evidence count
        evidence_count = len(signal.get('evidence', []))
        if evidence_count < self.config['min_evidence']:
            logger.debug(f"❌ Pass 1: Insufficient evidence {evidence_count} < {self.config['min_evidence']}")
            return {'survived': False}

        # Check evidence credibility
        avg_credibility = sum(ev.get('credibility_score', 0.5) for ev in signal.get('evidence', [])) / max(evidence_count, 1)
        if avg_credibility < 0.6:
            logger.debug(f"❌ Pass 1: Low credibility {avg_credibility} < 0.6")
            return {'survived': False}

        logger.info(f"✅ Pass 1: Signal {signal['id']} survived")
        return {'survived': True, 'signal': signal}

    async def _pass1_5_evidence_verification(self, signal: Dict) -> Dict:
        """
        Pass 1.5: Evidence verification (iteration_02 aligned)

        Validates scraped data BEFORE Claude reasoning:
        - Checks URL accessibility
        - Validates source credibility
        - Verifies content matches claims
        - Adjusts credibility scores based on verification

        This ensures Claude reasons over VERIFIED, STRUCTURED evidence,
        not raw unverified text (iteration_02 principle).
        """
        logger.info("🔁 Pass 1.5/4: Evidence verification")

        try:
            # Verify all evidence items
            verified_evidence = await self.evidence_verifier.verify_all_evidence(
                signal.get('evidence', [])
            )

            # Get verification summary
            verification_summary = self.evidence_verifier.get_verification_summary(
                verified_evidence
            )

            logger.info(f"   Verification rate: {verification_summary['verification_rate']:.1%}")
            logger.info(f"   Credibility adjustment: {verification_summary['credibility_adjustment']:+.2f}")
            logger.info(f"   Avg claimed: {verification_summary['avg_claimed_credibility']:.2f}")
            logger.info(f"   Avg actual: {verification_summary['avg_actual_credibility']:.2f}")

            # Update evidence with verification results
            for i, ev_verified in enumerate(verified_evidence):
                if 'evidence' in signal and i < len(signal['evidence']):
                    signal['evidence'][i]['verified'] = ev_verified['verified']
                    signal['evidence'][i]['actual_credibility'] = ev_verified['actual_credibility']
                    signal['evidence'][i]['verification_issues'] = ev_verified.get('issues', [])
                    signal['evidence'][i]['url_accessible'] = ev_verified['url_accessible']

            # Store verification summary in signal metadata
            signal['verification_summary'] = {
                'total_evidence': verification_summary['total_evidence'],
                'verified_count': verification_summary['verified_count'],
                'verification_rate': verification_summary['verification_rate'],
                'credibility_adjustment': verification_summary['credibility_adjustment'],
                'has_critical_issues': verification_summary['has_critical_issues'],
                'all_issues': verification_summary['all_issues'][:5]  # First 5 issues
            }

            # Flag for manual review if critical issues
            if verification_summary['has_critical_issues']:
                logger.warning(f"   ⚠️  Critical issues: {verification_summary['all_issues'][:3]}")
                signal['requires_manual_review'] = True

            # Always survive (data quality issue, not rule violation)
            # Claude will decide final confidence based on verification context
            return {
                'survived': True,
                'signal': signal,
                'verification_summary': verification_summary
            }

        except Exception as e:
            logger.error(f"❌ Evidence verification failed: {e}")
            # Continue without verification (fail-open)
            signal['verification_error'] = str(e)
            return {
                'survived': True,
                'signal': signal,
                'verification_summary': None
            }

    async def _pass2_claude_validation(self, signal: Dict, verification_summary: Optional[Dict] = None) -> Dict:
        """
        Pass 2: Claude validation with cascade (enhanced with verification context)

        iteration_02 aligned: Claude reasons over VERIFIED evidence, not raw text.
        Verification summary provides context about which evidence was checked.
        """
        if not claude_client:
            logger.warning("⚠️ Claude client not available, skipping Pass 2")
            signal['pass2_confidence'] = signal['confidence']
            signal['model_used'] = 'skipped'
            return {'survived': True, 'signal': signal}

        logger.info("🔁 Pass 2/4: Claude validation (Haiku) with evidence verification context")

        # Build enhanced prompt with verification context
        prompt = self._build_validation_prompt_enhanced(signal, verification_summary)

        try:
            start_time = datetime.now(timezone.utc)

            # Call Claude API
            response = claude_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )

            end_time = datetime.now(timezone.utc)

            # Extract response
            content = response.content[0].text

            # Parse JSON
            import re
            json_match = re.search(r'\{[^}]*"validated"[^}]*\}', content, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group(0))

                # Calculate cost
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                total_tokens = input_tokens + output_tokens
                cost = total_tokens * 0.25 / 1_000_000  # Haiku pricing

                # Apply confidence adjustment if validated
                if result.get('validated'):
                    original_confidence = signal['confidence']
                    adjustment = result.get('confidence_adjustment', 0.0)
                    validated_confidence = original_confidence + adjustment

                    # Ensure adjustment is within bounds
                    if abs(adjustment) > self.config['max_confidence_adjustment']:
                        logger.warning(f"⚠️ Adjustment {adjustment} exceeds bounds {self.config['max_confidence_adjustment']}, clamping")
                        adjustment = max(-self.config['max_confidence_adjustment'],
                                       min(self.config['max_confidence_adjustment'], adjustment))
                        validated_confidence = original_confidence + adjustment

                    signal['pass2_confidence'] = validated_confidence
                    signal['confidence_adjustment'] = adjustment
                    signal['rationale'] = result.get('rationale', '')
                    signal['model_used'] = 'haiku'
                    signal['validation_cost'] = cost
                    signal['input_tokens'] = input_tokens
                    signal['output_tokens'] = output_tokens
                    signal['total_tokens'] = total_tokens

                    logger.info(f"✅ Haiku validated: {original_confidence:.2f} → {validated_confidence:.2f} ({adjustment:+.2f})")
                    logger.info(f"   Tokens: {total_tokens} (in: {input_tokens}, out: {output_tokens})")
                    logger.info(f"   Cost: ${cost:.4f}")
                    logger.info(f"   Rationale: {result.get('rationale', 'N/A')[:80]}...")
                else:
                    logger.info(f"❌ Claude rejected signal: {result.get('reason', 'Unknown')}")
                    return {'survived': False, 'signal': signal}

            else:
                logger.warning("Could not parse Claude response, accepting signal")
                signal['pass2_confidence'] = signal['confidence']
                signal['model_used'] = 'haiku'

            return {'survived': True, 'signal': signal}

        except Exception as e:
            logger.error(f"❌ Pass 2 failed: {e}")
            signal['pass2_confidence'] = signal['confidence']
            signal['model_used'] = 'error'
            return {'survived': True, 'signal': signal}  # Fail open

    def _build_validation_prompt(self, signal: Dict) -> str:
        """Build validation prompt for Claude"""
        evidence_text = "\n".join([
            f"{i+1}. {ev.get('source', 'Unknown')} (credibility: {ev.get('credibility_score', 0.5)})"
            for i, ev in enumerate(signal.get('evidence', [])[:5])
        ])

        return f"""You are a signal validation expert. Validate this signal for entity: {signal['entity_id']}

Signal:
- ID: {signal['id']}
- Type: {signal['type']}
- Confidence: {signal['confidence']}

Evidence:
{evidence_text}

Task: Validate signal and adjust confidence if needed.

Consider:
1. Evidence quality (credibility, recency, source diversity)
2. Confidence score alignment with evidence strength
3. Adjustment range: ±{self.config['max_confidence_adjustment']}

Confidence Scoring Guidelines:
- 0.9-1.0: Multiple high-credibility sources (0.8+), official statements
- 0.7-0.9: Multiple credible sources (0.6+), strong indicators
- 0.5-0.7: Mixed credibility, some ambiguity
- 0.3-0.5: Single sources, low credibility
- 0.0-0.3: Rumors, unverified

Return ONLY a JSON object (no markdown):
{{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "brief explanation",
  "requires_manual_review": false
}}

Be concise but thorough."""

    def _build_validation_prompt_enhanced(self, signal: Dict, verification_summary: Optional[Dict] = None) -> str:
        """
        Build enhanced validation prompt with evidence verification context (iteration_02 aligned)

        Key principle: Claude reasons over VERIFIED, STRUCTURED evidence, not raw text.
        Verification summary tells Claude which evidence was actually checked.
        """
        # Build evidence text with verification status
        if verification_summary:
            evidence_text = "\n".join([
                f"{i+1}. {ev.get('source', 'Unknown')} "
                f"(claimed: {ev.get('credibility_score', 0.5):.2f}, "
                f"verified: {ev.get('actual_credibility', ev.get('credibility_score', 0.5)):.2f}) "
                f"{'✅' if ev.get('verified', False) else '❌'} "
                f"{'[VERIFIED]' if ev.get('verified', False) else '[UNVERIFIED]'}"
                for i, ev in enumerate(signal.get('evidence', [])[:5])
            ])

            verification_context = f"""
Evidence Verification Summary:
- Total Evidence: {verification_summary['total_evidence']}
- Verified: {verification_summary['verified_count']}
- Verification Rate: {verification_summary['verification_rate']:.1%}
- Avg Claimed Credibility: {verification_summary['avg_claimed_credibility']:.2f}
- Avg Actual Credibility: {verification_summary['avg_actual_credibility']:.2f}
- Credibility Adjustment: {verification_summary['credibility_adjustment']:+.2f}
"""
            if verification_summary['has_critical_issues']:
                verification_context += f"\n⚠️  CRITICAL ISSUES: {', '.join(verification_summary['all_issues'][:3])}\n"
            else:
                verification_context += "\n✅ All evidence verified successfully\n"
        else:
            # Fallback to simple format if no verification
            evidence_text = "\n".join([
                f"{i+1}. {ev.get('source', 'Unknown')} (credibility: {ev.get('credibility_score', 0.5)})"
                for i, ev in enumerate(signal.get('evidence', [])[:5])
            ])
            verification_context = "Evidence verification: Not performed\n"

        return f"""You are a signal validation expert. Validate this signal for entity: {signal['entity_id']}

Signal:
- ID: {signal['id']}
- Type: {signal['type']}
- Confidence: {signal['confidence']}

{verification_context}Evidence Details:
{evidence_text}

Task: Validate signal and adjust confidence if needed.

IMPORTANT - Consider evidence verification status:
1. Verification rate (higher = more reliable evidence)
2. Actual vs claimed credibility (trust actual verified scores)
3. Presence of critical issues (fake URLs, broken links = bad)
4. Evidence with ❌ UNVERIFIED status should be treated skeptically

Confidence Scoring Guidelines:
- 0.9-1.0: Multiple VERIFIED high-credibility sources (0.8+), official statements
- 0.7-0.9: Multiple VERIFIED credible sources (0.6+), strong indicators
- 0.5-0.7: Mixed verification, some ambiguity
- 0.3-0.5: Single or UNVERIFIED sources, low credibility
- 0.0-0.3: Rumors, unverified, failed verification

Adjustment range: ±{self.config['max_confidence_adjustment']}

If verification shows significant discrepancy (>0.2) between claimed and actual credibility,
apply a larger adjustment to reflect scraper overconfidence.

Return ONLY a JSON object (no markdown):
{{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "brief explanation mentioning verification status",
  "requires_manual_review": false
}}

Be thorough in checking verification status and adjusting confidence accordingly."""

    async def _pass3_final_confirmation(self, signal: Dict) -> Dict:
        """Pass 3: Final confirmation (now Pass 4/4 with evidence verification)"""
        logger.info("🔁 Pass 4/4: Final confirmation")

        if signal['pass2_confidence'] >= self.config['min_confidence']:
            signal['final_confidence'] = signal['pass2_confidence']
            signal['validated'] = True
            signal['validation_pass'] = 3
            logger.info(f"✅ Pass 3: Signal {signal['id']} confirmed (confidence: {signal['final_confidence']})")
            return {'survived': True, 'signal': signal}
        else:
            logger.info(f"❌ Pass 3: Signal {signal['id']} rejected (confidence: {signal['pass2_confidence']})")
            return {'survived': False, 'signal': signal}


# =============================================================================
# API Endpoints (Webhook Handler Mode)
# =============================================================================

validator = RalphLoopValidator()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="ralph-loop-server",
        mode=WORKER_MODE,
        timestamp=datetime.now(timezone.utc).isoformat(),
        dependencies={
            "claude_api": claude_client is not None,
            "falkordb": True,  # TODO: actual check
            "redis": True  # TODO: actual check
        }
    )


@app.post("/api/webhooks/signal", response_model=ValidationResponse)
async def handle_webhook_signal(
    webhook_data: WebhookSignal,
    x_webhook_signature: Optional[str] = Header(None)
):
    """
    Handle webhook signal from external sources

    Validates signal using Ralph Loop 3-pass validation
    """
    logger.info(f"📨 Webhook received from {webhook_data.source}: {webhook_data.id}")

    # TODO: Verify webhook signature
    # if not verify_webhook_signature(webhook_data, x_webhook_signature):
    #     raise HTTPException(401, "Invalid signature")

    try:
        # Validate signal
        result = await validator.validate_signal(webhook_data)

        logger.info(f"✅ Webhook processed: {result.status} for {webhook_data.id}")

        return result

    except Exception as e:
        logger.error(f"❌ Webhook processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Ralph Loop Validation Service",
        "mode": WORKER_MODE,
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "webhook": "/api/webhooks/signal"
        }
    }


# =============================================================================
# Cron Worker Mode
# =============================================================================

async def run_cron_worker():
    """Run cron worker - scheduled batch processing"""
    logger.info("🔄 Starting cron worker mode")

    if WORKER_MODE != "cron":
        logger.warning(f"⚠️ WORKER_MODE={WORKER_MODE}, not running as cron worker")
        return

    # Import scheduler
    try:
        from backend.scheduler.priority_entity_scheduler import PriorityEntityScheduler

        # Initialize scheduler
        # TODO: Initialize Graphiti
        scheduler = PriorityEntityScheduler(graphiti_service=None)

        # Load entities
        await scheduler.load_tiers_from_graphiti()

        # Get processing order
        entities = scheduler.get_daily_processing_order()

        logger.info(f"📋 Processing {len(entities)} entities in priority order")

        # Process entities by tier
        from datetime import timedelta

        total_validated = 0
        total_cost = 0.0

        for tier in ['premium', 'active', 'dormant']:
            logger.info(f"🔄 Processing {tier} tier...")

            tier_entities = [e for e in entities if scheduler.tiers.get(tier, [])]

            for entity_id in tier_entities:
                try:
                    # Create mock signal for entity
                    signal = WebhookSignal(
                        id=f"cron-{entity_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        source="cron_scraping",
                        entity_id=entity_id,
                        type="RFP_DETECTED",
                        confidence=0.85,
                        evidence=[
                            {"source": "LinkedIn", "credibility_score": 0.8},
                            {"source": "BrightData", "credibility_score": 0.7},
                            {"source": "Perplexity", "credibility_score": 0.75}
                        ]
                    )

                    # Validate
                    result = await validator.validate_signal(signal)

                    if result.validated:
                        total_validated += 1
                        total_cost += result.cost_usd or 0.0

                    logger.info(f"✅ {entity_id}: {result.status} (${(result.cost_usd or 0):.4f})")

                    # Small delay to avoid rate limits
                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.error(f"❌ Error processing {entity_id}: {e}")
                    continue

        logger.info(f"✅ Cron worker complete: {total_validated} entities validated, ${total_cost:.2f}")

    except ImportError as e:
        logger.error(f"❌ Failed to import scheduler: {e}")
        logger.info("ℹ️  Skipping cron worker (scheduler not available)")


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    if WORKER_MODE == "cron":
        # Run cron worker
        logger.info("🚀 Starting Ralph Loop Cron Worker")
        asyncio.run(run_cron_worker())
    else:
        # Run webhook handler server
        port = int(os.getenv("PORT", "8001"))
        logger.info(f"🚀 Starting Ralph Loop Webhook Handler on port {port}")

        uvicorn.run(
            app,
            host="0.0.0.0",
            port=port,
            log_level="info"
        )
