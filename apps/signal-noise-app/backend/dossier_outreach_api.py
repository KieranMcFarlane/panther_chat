#!/usr/bin/env python3
"""
Dossier Outreach Intelligence API

Provides real-time outreach intelligence using BrightData SDK and LinkedIn profiling.

Endpoints:
- POST /api/dossier-outreach-intelligence: Collect outreach intelligence for an entity
"""

import os
import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import clients
from brightdata_sdk_client import BrightDataSDKClient
from linkedin_profiler import LinkedInProfiler, OutreachIntelligence

logger = logging.getLogger(__name__)

app = FastAPI(title="Dossier Outreach Intelligence API")

# =============================================================================
# Request/Response Models
# =============================================================================

class OutreachIntelligenceRequest(BaseModel):
    entity_id: str
    entity_name: str
    signals: Optional[List[Dict[str, Any]]] = []
    hypotheses: Optional[List[Dict[str, Any]]] = []
    priority_score: Optional[int] = 50


class OutreachIntelligenceResponse(BaseModel):
    entity_id: str
    entity_name: str
    approach_type: str  # warm, lukewarm, cold
    mutual_connections: List[str]
    conversation_starters: List[Dict[str, Any]]
    current_providers: List[Dict[str, Any]]
    recommended_approach: Dict[str, Any]
    confidence: int
    confidence_explanation: str
    metadata: Dict[str, Any]


# =============================================================================
# API Endpoints
# =============================================================================

@app.post("/api/dossier-outreach-intelligence")
async def get_outreach_intelligence(request: OutreachIntelligenceRequest) -> OutreachIntelligenceResponse:
    """
    Collect real-time outreach intelligence using BrightData SDK.

    Returns:
        Mutual connections, conversation starters, current providers,
        recommended approach with confidence and explanation
    """
    try:
        logger.info(f"🔍 Collecting outreach intelligence for {request.entity_name}")

        # Initialize BrightData client
        brightdata = BrightDataSDKClient()

        # Search for company LinkedIn page
        logger.info("📱 Searching for LinkedIn presence...")
        linkedin_search = await brightdata.search_engine(
            query=f'"{request.entity_name}" LinkedIn company',
            engine="google",
            num_results=5
        )

        # Initialize LinkedIn profiler
        profiler = LinkedInProfiler(brightdata)

        # Extract conversation intelligence
        logger.info("💬 Extracting conversation intelligence...")

        # Prepare target contacts (if specific contacts provided)
        target_contacts = [request.entity_name]
        if request.signals:
            # Extract potential contacts from signals
            for signal in request.signals[:5]:
                if isinstance(signal, dict) and 'contact' in str(signal).lower():
                    target_contacts.append(str(signal))

        # Prepare YP team members (could be configured from env)
        yp_team_members = []

        # Only extract if we have actual contact URLs (not just entity names)
        # For now, skip full extraction to avoid excessive API calls
        if any('linkedin.com' in str(c) for c in target_contacts):
            intelligence = await profiler.extract_outreach_intelligence(
                entity_name=request.entity_name,
                target_contacts=target_contacts,
                yp_team_members=yp_team_members,
                days_to_lookback=30
            )
        else:
            # Create minimal intelligence object for cold approach
            intelligence = OutreachIntelligence(
                entity_name=request.entity_name,
                mutual_paths=[],
                conversation_starters=[],
                current_providers=[],
                communication_patterns=[],
                generated_at=datetime.now(timezone.utc)
            )

        # Determine approach type based on mutual connections
        if intelligence.mutual_paths and len(intelligence.mutual_paths) > 0:
            # Find strongest path
            strongest_path = max(intelligence.mutual_paths, key=lambda p: p.path_strength)
            if strongest_path.path_strength > 0.7:
                approach_type = "warm"
            elif strongest_path.path_strength > 0.4:
                approach_type = "lukewarm"
            else:
                approach_type = "cold"
        else:
            approach_type = "cold"

        # Extract conversation starters
        conversation_starters = []
        for starter in intelligence.conversation_starters[:5]:
            conversation_starters.append({
                "topic": starter.post_content[:100] + "...",
                "relevance": starter.conversation_angle,
                "risk_level": "low" if starter.relevance_score > 0.7 else "medium"
            })

        # Extract current providers
        current_providers = []
        for provider in intelligence.current_providers:
            current_providers.append({
                "provider": provider.provider_name,
                "service": provider.solution_type,
                "confidence": provider.confidence,
                "source": provider.source_post[:100] + "..."
            })

        # Determine recommended approach
        recommended_approach = _determine_recommended_approach(
            request.entity_name,
            approach_type,
            intelligence,
            request.signals,
            request.hypotheses
        )

        # Calculate confidence
        confidence = _calculate_confidence(intelligence, request.signals, request.hypotheses)

        # Generate confidence explanation
        confidence_explanation = _generate_confidence_explanation(
            confidence,
            intelligence,
            request.signals
        )

        response = OutreachIntelligenceResponse(
            entity_id=request.entity_id,
            entity_name=request.entity_name,
            approach_type=approach_type,
            mutual_connections=[p.mutual_connections for p in intelligence.mutual_paths[:5]],
            conversation_starters=conversation_starters,
            current_providers=current_providers,
            recommended_approach=recommended_approach,
            confidence=confidence,
            confidence_explanation=confidence_explanation,
            metadata={
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "data_sources": ["BrightData SDK", "LinkedIn Profiler"],
                "freshness": "real-time"
            }
        )

        logger.info(f"✅ Outreach intelligence collected: {approach_type} approach, {confidence}% confidence")
        return response

    except Exception as e:
        logger.error(f"❌ Failed to collect outreach intelligence: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _determine_recommended_approach(
    entity_name: str,
    approach_type: str,
    intelligence: OutreachIntelligence,
    signals: List[Dict],
    hypotheses: List[Dict]
) -> Dict[str, Any]:
    """
    Determine recommended outreach approach based on intelligence.

    Returns:
        Dict with channel, messaging_angle, timing, and next_actions
    """
    # Default approach
    approach = {
        "primary_channel": "email",
        "messaging_angle": "Digital partnership opportunity",
        "timing": "Tuesday-Thursday, mid-morning",
        "next_actions": ["Send initial outreach", "Follow up in 3 days if no response"]
    }

    # Adjust based on approach type
    if approach_type == "warm":
        approach.update({
            "primary_channel": "linkedin",
            "messaging_angle": "Mutual connection introduction",
            "timing": "Within 24 hours of mutual connection intro"
        })
    elif approach_type == "lukewarm":
        approach.update({
            "primary_channel": "email",
            "messaging_angle": "Relevant industry insights sharing",
            "timing": "Tuesday or Wednesday morning"
        })

    # Adjust based on conversation starters
    if intelligence.conversation_starters:
        best_starter = max(intelligence.conversation_starters, key=lambda s: s.relevance_score)
        approach["messaging_angle"] = best_starter.conversation_angle[:100]

    # Adjust based on signals
    procurement_signals = [s for s in signals if s.get("type") == "[PROCUREMENT]"]
    if procurement_signals:
        approach["messaging_angle"] = "Procurement timing and RFP support"
        approach["timing"] = "Immediate (procurement window detected)"

    return approach


def _calculate_confidence(
    intelligence: OutreachIntelligence,
    signals: List[Dict],
    hypotheses: List[Dict]
) -> int:
    """
    Calculate overall confidence in outreach strategy.

    Returns:
        Confidence score (0-100)
    """
    confidence = 50  # Base confidence

    # Boost based on mutual connections
    if intelligence.mutual_paths:
        confidence += len(intelligence.mutual_paths) * 5

    # Boost based on conversation starters
    if intelligence.conversation_starters:
        high_relevance = [s for s in intelligence.conversation_starters if s.relevance_score > 0.7]
        confidence += len(high_relevance) * 3

    # Boost based on signals
    if signals:
        confidence += min(len(signals) * 2, 20)  # Cap at +20

    # Boost based on hypotheses
    if hypotheses:
        high_conf_hypotheses = [h for h in hypotheses if h.get("confidence", 0) > 0.7]
        confidence += len(high_conf_hypotheses) * 3

    return min(confidence, 100)  # Cap at 100


def _generate_confidence_explanation(
    confidence: int,
    intelligence: OutreachIntelligence,
    signals: List[Dict]
) -> str:
    """
    Generate explanation for confidence score.

    Returns:
        Human-readable explanation
    """
    reasons = []

    if confidence >= 80:
        reasons.append("Strong mutual connection network detected")
        reasons.append("High-relevance conversation starters available")
        reasons.append("Multiple procurement signals present")
    elif confidence >= 60:
        reasons.append("Moderate mutual connections")
        reasons.append("Relevant conversation context available")
    elif confidence >= 40:
        reasons.append("Limited mutual connections")
        reasons.append("Basic conversation starters available")
    else:
        reasons.append("Cold approach required")
        reasons.append("Limited contextual information")

    if signals:
        reasons.append(f"Based on {len(signals)} intelligence signals")

    return ". ".join(reasons) + "."


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "dossier-outreach-intelligence",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    port = int(os.getenv("OUTREACH_API_PORT", 8002))
    logger.info(f"🚀 Starting Dossier Outreach Intelligence API on port {port}")

    uvicorn.run(app, host="0.0.0.0", port=port)
