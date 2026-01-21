#!/usr/bin/env python3
"""
Smart notification service that prioritizes RFP alerts based on temporal patterns.

This service:
1. Prioritizes RFPs based on temporal fit scores
2. Boosts priority for entities with increasing trends
3. Routes to different notification channels based on priority level
4. Implements the "CLOSE THE LOOP" feedback mechanism

Usage:
    from backend.notification_service import NotificationService

    service = NotificationService()
    prioritized = await service.prioritize_rfps(detected_rfps)
    await service.send_notifications(prioritized)
"""

import os
import sys
import logging
import asyncio
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NotificationLevel(str, Enum):
    """Notification priority levels"""
    URGENT = "URGENT"      # Send immediately via all channels
    HIGH = "HIGH"          # Send immediately via email + Teams
    NORMAL = "NORMAL"      # Send via digest
    LOW = "LOW"            # Log only, no notification


@dataclass
class NotificationPriority:
    """Priority score and level for an RFP"""
    rfp_id: str
    entity_id: str
    organization: str
    base_score: float
    trend_boost: float
    final_score: float
    level: NotificationLevel
    factors: List[Dict[str, Any]]
    timestamp: str


class NotificationService:
    """
    Smart notification service for RFP alerts

    Prioritizes notifications based on:
    - Temporal fit scores from historical analysis
    - Trend direction (increasing trends get priority boost)
    - RFP category relevance
    - Estimated value
    """

    def __init__(self, fastapi_url: Optional[str] = None):
        """
        Initialize the notification service

        Args:
            fastapi_url: URL of the FastAPI backend for temporal analysis
        """
        self.fastapi_url = fastapi_url or os.getenv("FASTAPI_URL", "http://localhost:8000")

        # Priority thresholds
        self.urgent_threshold = 0.8
        self.high_threshold = 0.7
        self.normal_threshold = 0.4

        # Boost for increasing trends
        self.increasing_trend_boost = 0.1
        self.high_value_boost = 0.05  # For RFPs over $100k

        # Notification channels
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.teams_webhook_url = os.getenv("TEAMS_WEBHOOK_URL")

        logger.info(f"🔔 NotificationService initialized (FastAPI: {self.fastapi_url})")

    async def get_temporal_fit(
        self,
        entity_id: str,
        rfp_id: str,
        rfp_category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get temporal fit analysis for an entity-RFP pair

        Args:
            entity_id: Entity identifier
            rfp_id: RFP identifier
            rfp_category: Optional RFP category

        Returns:
            Temporal fit analysis data
        """
        import httpx

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.fastapi_url}/api/temporal/analyze-fit",
                    json={
                        "entity_id": entity_id,
                        "rfp_id": rfp_id,
                        "rfp_category": rfp_category,
                        "time_horizon": 90
                    }
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning(f"Failed to get temporal fit for {entity_id}: {e}")
            # Return default values
            return {
                "fit_score": 0.5,
                "confidence": 0.5,
                "trend_analysis": {"trend": "unknown"},
                "key_factors": [],
                "recommendations": []
            }

    async def prioritize_rfps(
        self,
        detected_rfps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Prioritize RFPs based on temporal fit and trends

        Args:
            detected_rfps: List of detected RFPs with metadata

        Returns:
            Prioritized RFPs with notification levels
        """
        prioritized = []
        tasks = []

        # Create tasks for parallel temporal analysis
        for rfp in detected_rfps:
            org = rfp.get('organization', 'Unknown')
            entity_id = org.lower().replace(' ', '-')
            rfp_id = rfp.get('rfp_id') or f"{entity_id}-{rfp.get('title', 'unknown')}"
            category = rfp.get('summary_json', {}).get('category') or rfp.get('category')

            task = self._prioritize_single_rfp(rfp, entity_id, rfp_id, category)
            tasks.append(task)

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error prioritizing RFP: {result}")
            elif result:
                prioritized.append(result)

        # Sort by priority score (highest first)
        prioritized.sort(key=lambda x: x.get('priority', 0), reverse=True)

        logger.info(f"✅ Prioritized {len(prioritized)} RFP(s)")
        return prioritized

    async def _prioritize_single_rfp(
        self,
        rfp: Dict[str, Any],
        entity_id: str,
        rfp_id: str,
        category: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Prioritize a single RFP

        Args:
            rfp: RFP data
            entity_id: Entity identifier
            rfp_id: RFP identifier
            category: RFP category

        Returns:
            Enhanced RFP with priority information
        """
        # Get temporal fit
        fit = await self.get_temporal_fit(entity_id, rfp_id, category)

        # Calculate base priority from fit score
        base_score = fit.get('fit_score', 0.5)

        # Apply trend boost
        priority = base_score
        trend = fit.get('trend_analysis', {}).get('trend', 'stable')
        factors = []

        if trend == 'increasing':
            priority += self.increasing_trend_boost
            factors.append({
                'factor': 'increasing_trend',
                'boost': self.increasing_trend_boost,
                'description': 'Entity showing increasing RFP activity'
            })

        # Apply high value boost
        estimated_value = rfp.get('summary_json', {}).get('estimated_value') or rfp.get('estimated_value')
        if estimated_value and estimated_value > 100000:
            priority += self.high_value_boost
            factors.append({
                'factor': 'high_value',
                'boost': self.high_value_boost,
                'description': f'High value RFP (${estimated_value:,.0f})'
            })

        # Cap at 1.0
        priority = min(1.0, priority)

        # Determine notification level
        level = self._get_notification_level(priority)

        # Add category relevance factor
        if category:
            factors.append({
                'factor': 'category_match',
                'value': category,
                'description': f'RFP in {category} category'
            })

        # Enhance RFP with priority data
        enhanced_rfp = rfp.copy()
        enhanced_rfp['priority'] = priority
        enhanced_rfp['notification_level'] = level
        enhanced_rfp['priority_factors'] = factors
        enhanced_rfp['temporal_fit'] = fit

        return enhanced_rfp

    def _get_notification_level(self, priority: float) -> NotificationLevel:
        """Determine notification level from priority score"""
        if priority >= self.urgent_threshold:
            return NotificationLevel.URGENT
        elif priority >= self.high_threshold:
            return NotificationLevel.HIGH
        elif priority >= self.normal_threshold:
            return NotificationLevel.NORMAL
        else:
            return NotificationLevel.LOW

    async def send_notifications(self, rfps: List[Dict[str, Any]]):
        """
        Send notifications based on priority levels

        Args:
            rfps: Prioritized RFP list with notification levels
        """
        urgent_count = high_count = normal_count = low_count = 0

        for rfp in rfps:
            level = rfp.get('notification_level', NotificationLevel.NORMAL)

            if level == NotificationLevel.URGENT:
                await self._send_urgent_notification(rfp)
                urgent_count += 1
            elif level == NotificationLevel.HIGH:
                await self._send_immediate_notification(rfp)
                high_count += 1
            elif level == NotificationLevel.NORMAL:
                await self._send_digest_notification(rfp)
                normal_count += 1
            else:
                # LOW - just log, no notification
                low_count += 1

        logger.info(
            f"📊 Notifications sent: "
            f"URGENT={urgent_count}, HIGH={high_count}, "
            f"NORMAL={normal_count}, LOW={low_count} (logged only)"
        )

    async def _send_urgent_notification(self, rfp: Dict[str, Any]):
        """Send urgent notification via all channels"""
        logger.info(f"🚨 URGENT: {rfp.get('organization')} - {rfp.get('summary_json', {}).get('title', 'Unknown')}")

        # Send via Resend email
        if self.resend_api_key:
            await self._send_email(rfp, urgent=True)

        # Send via Teams webhook
        if self.teams_webhook_url:
            await self._send_teams_alert(rfp, urgent=True)

    async def _send_immediate_notification(self, rfp: Dict[str, Any]):
        """Send immediate notification via email and Teams"""
        logger.info(f"⚠️  HIGH: {rfp.get('organization')} - {rfp.get('summary_json', {}).get('title', 'Unknown')}")

        if self.resend_api_key:
            await self._send_email(rfp, urgent=False)

        if self.teams_webhook_url:
            await self._send_teams_alert(rfp, urgent=False)

    async def _send_digest_notification(self, rfp: Dict[str, Any]):
        """Add to digest (log for now, could batch)"""
        logger.info(f"📋 NORMAL: {rfp.get('organization')} - {rfp.get('summary_json', {}).get('title', 'Unknown')}")
        # In production, these would be batched into a daily digest

    async def _send_email(self, rfp: Dict[str, Any], urgent: bool = False):
        """Send email notification via Resend"""
        import httpx

        org = rfp.get('organization', 'Unknown')
        title = rfp.get('summary_json', {}).get('title') or rfp.get('title', 'Unknown RFP')
        priority = rfp.get('priority', 0.5)
        url = rfp.get('src_link') or rfp.get('url', '#')

        emoji = "🚨" if urgent else "⚠️"
        subject = f"{emoji} High-Priority RFP Alert: {org}"

        html = f"""
        <h2>{emoji} RFP Opportunity Alert</h2>
        <p><strong>Organization:</strong> {org}</p>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Priority Score:</strong> {priority:.2f}</p>
        <p><strong>Source:</strong> <a href="{url}">View RFP</a></p>
        """

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": "Yellow Panther <alerts@yellowpanther.ai>",
                        "to": ["team@yellowpanther.ai"],
                        "subject": subject,
                        "html": html
                    }
                )
        except Exception as e:
            logger.error(f"Failed to send email: {e}")

    async def _send_teams_alert(self, rfp: Dict[str, Any], urgent: bool = False):
        """Send Microsoft Teams webhook notification"""
        import httpx

        org = rfp.get('organization', 'Unknown')
        title = rfp.get('summary_json', {}).get('title') or rfp.get('title', 'Unknown RFP')
        priority = rfp.get('priority', 0.5)
        url = rfp.get('src_link') or rfp.get('url', '#')

        emoji = "🚨" if urgent else "⚠️"
        color = "FF0000" if urgent else "FFA500"

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    self.teams_webhook_url,
                    json={
                        "@type": "MessageCard",
                        "@context": "https://schema.org/extensions",
                        "summary": f"RFP Alert: {org}",
                        "themeColor": color,
                        "title": f"{emoji} {org}",
                        "text": f"**{title}**\n\nPriority: {priority:.2f}\n\n[View RFP]({url})"
                    }
                )
        except Exception as e:
            logger.error(f"Failed to send Teams alert: {e}")


# =============================================================================
# Convenience Functions
# =============================================================================

async def prioritize_and_notify(detected_rfps: List[Dict[str, Any]]):
    """
    Convenience function to prioritize RFPs and send notifications

    Args:
        detected_rfps: List of detected RFPs
    """
    service = NotificationService()
    prioritized = await service.prioritize_rfps(detected_rfps)
    await service.send_notifications(prioritized)
    return prioritized


if __name__ == "__main__":
    # Test the notification service
    import asyncio

    async def test():
        service = NotificationService()

        # Test RFPs
        test_rfps = [
            {
                "organization": "Arsenal FC",
                "rfp_id": "arsenal-rfp-001",
                "title": "Digital Transformation Partner",
                "category": "Technology",
                "estimated_value": 150000,
                "summary_json": {
                    "title": "Digital Transformation Partner",
                    "category": "Technology",
                    "estimated_value": 150000
                }
            },
            {
                "organization": "Chelsea FC",
                "rfp_id": "chelsea-rfp-001",
                "title": "Mobile App Development",
                "category": "Technology",
                "summary_json": {
                    "title": "Mobile App Development",
                    "category": "Technology"
                }
            }
        ]

        prioritized = await service.prioritize_rfps(test_rfps)

        print("\n=== Prioritized RFPs ===")
        for rfp in prioritized:
            print(f"{rfp['organization']}: {rfp['priority']:.2f} ({rfp['notification_level']})")

    asyncio.run(test())
