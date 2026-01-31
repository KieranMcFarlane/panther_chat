"""
Alert Manager - Multi-Channel Alert Orchestration

Orchestrates alerts across multiple channels (email, webhook, Slack)
based on opportunity priority tiers.

TIER_1 (Critical): All channels, immediate
TIER_2 (High): Email + Webhook + Slack, within 1 hour
TIER_3 (Medium): Email digest, daily
TIER_4 (Low): Dashboard only, weekly summary
"""

import os
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum

from .email_client import EmailClient
from .webhook_client import WebhookClient
from .slack_client import SlackClient


class PriorityTier(str, Enum):
    """Opportunity priority tiers"""
    TIER_1 = "TIER_1"  # Critical: Immediate notification
    TIER_2 = "TIER_2"  # High: Within 1 hour
    TIER_3 = "TIER_3"  # Medium: Daily digest
    TIER_4 = "TIER_4"  # Low: Weekly summary


class AlertChannel(str, Enum):
    """Available alert channels"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    SLACK = "slack"
    DASHBOARD = "dashboard"


class AlertManager:
    """
    Multi-channel alert system for RFP opportunities.

    Routes alerts to appropriate channels based on priority tier.

    Configuration (via environment variables):
    - YELLOW_PANTHER_EMAIL: YP email address
    - YELLOW_PANTHER_WEBHOOK_URL: Webhook endpoint
    - YELLOW_PANTHER_WEBHOOK_KEY: Webhook auth key
    - SLACK_WORKSPACE: Slack workspace name
    - ALERTS_ENABLED: Enable/disable alerts (default: true)
    """

    # Tier channel configurations
    TIER_CHANNELS = {
        PriorityTier.TIER_1: [
            AlertChannel.EMAIL,
            AlertChannel.WEBHOOK,
            AlertChannel.SLACK,
            AlertChannel.DASHBOARD
        ],
        PriorityTier.TIER_2: [
            AlertChannel.EMAIL,
            AlertChannel.WEBHOOK,
            AlertChannel.SLACK,
            AlertChannel.DASHBOARD
        ],
        PriorityTier.TIER_3: [
            AlertChannel.EMAIL,
            AlertChannel.DASHBOARD
        ],
        PriorityTier.TIER_4: [
            AlertChannel.DASHBOARD
        ]
    }

    # Tier urgency settings
    TIER_URGENCY = {
        PriorityTier.TIER_1: "immediate",
        PriorityTier.TIER_2: "1_hour",
        PriorityTier.TIER_3: "daily_digest",
        PriorityTier.TIER_4: "weekly_summary"
    }

    def __init__(
        self,
        email_client: Optional[EmailClient] = None,
        webhook_client: Optional[WebhookClient] = None,
        slack_client: Optional[SlackClient] = None
    ):
        """
        Initialize alert manager with channel clients.

        Args:
            email_client: Email client (creates default if None)
            webhook_client: Webhook client (creates default if None)
            slack_client: Slack client (creates default if None)
        """
        self.email_client = email_client or EmailClient()
        self.webhook_client = webhook_client or WebhookClient()
        self.slack_client = slack_client or SlackClient()

        # Check if alerts are enabled
        self.enabled = os.getenv("ALERTS_ENABLED", "true").lower() == "true"

    async def send_alert(
        self,
        opportunity: Dict,
        tier: PriorityTier,
        channels: Optional[List[AlertChannel]] = None
    ) -> Dict:
        """
        Send alert through appropriate channels based on tier.

        Args:
            opportunity: Opportunity details with:
                - entity_name, entity_id
                - category, signal_type
                - fit_score, priority
                - temporal_multiplier, confidence
                - budget_alignment, service_alignment
                - reasoning, recommended_actions
                - yp_advantages
            tier: Priority tier (TIER_1, TIER_2, TIER_3, TIER_4)
            channels: Override default channels for tier (optional)

        Returns:
            {
                "success": bool,
                "channels_sent": ["email", "webhook", "slack"],
                "channels_failed": [],
                "errors": {...},
                "timestamp": "ISO timestamp"
            }
        """
        if not self.enabled:
            return {
                "success": False,
                "channels_sent": [],
                "channels_failed": [],
                "errors": {"disabled": "Alerts are disabled"},
                "timestamp": datetime.now().isoformat()
            }

        # Determine which channels to use
        if channels is None:
            channels = self.TIER_CHANNELS.get(tier, [])

        # Track results
        channels_sent = []
        channels_failed = []
        errors = {}

        # Send to each channel
        tasks = []
        for channel in channels:
            task = self._send_to_channel(channel, opportunity, tier)
            tasks.append((channel, task))

        # Execute in parallel
        results = await asyncio.gather(
            *[task for _, task in tasks],
            return_exceptions=True
        )

        # Process results
        for (channel, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                channels_failed.append(channel.value)
                errors[channel.value] = str(result)
            elif result.get('success', False):
                channels_sent.append(channel.value)
            else:
                channels_failed.append(channel.value)
                if 'error' in result:
                    errors[channel.value] = result['error']

        # Log alert event (for audit)
        await self._log_alert_event(
            opportunity, tier, channels_sent, channels_failed, errors
        )

        return {
            "success": len(channels_failed) == 0,
            "channels_sent": channels_sent,
            "channels_failed": channels_failed,
            "errors": errors,
            "timestamp": datetime.now().isoformat()
        }

    async def _send_to_channel(
        self,
        channel: AlertChannel,
        opportunity: Dict,
        tier: PriorityTier
    ) -> Dict:
        """Send alert to specific channel"""
        try:
            if channel == AlertChannel.EMAIL:
                urgency = self.TIER_URGENCY.get(tier, "daily")
                return await self.email_client.send_opportunity_alert(
                    opportunity, tier, urgency
                )

            elif channel == AlertChannel.WEBHOOK:
                return await self.webhook_client.send_webhook(
                    opportunity, tier
                )

            elif channel == AlertChannel.SLACK:
                slack_channel = self._get_slack_channel(tier)
                return await self.slack_client.send_notification(
                    slack_channel, opportunity, tier
                )

            elif channel == AlertChannel.DASHBOARD:
                # Add to dashboard feed (no external call)
                return await self._add_to_dashboard_feed(opportunity, tier)

            else:
                return {
                    "success": False,
                    "error": f"Unknown channel: {channel}"
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _get_slack_channel(self, tier: PriorityTier) -> str:
        """Get Slack channel based on tier"""
        channels = {
            PriorityTier.TIER_1: os.getenv("SLACK_CRITICAL_CHANNEL", "#alerts-critical"),
            PriorityTier.TIER_2: os.getenv("SLACK_OPPORTUNITIES_CHANNEL", "#opportunities"),
            PriorityTier.TIER_3: os.getenv("SLACK_DAILY_CHANNEL", "#daily-summary"),
            PriorityTier.TIER_4: os.getenv("SLACK_WEEKLY_CHANNEL", "#weekly-summary")
        }
        return channels.get(tier, "#opportunities")

    async def _add_to_dashboard_feed(self, opportunity: Dict, tier: PriorityTier) -> Dict:
        """
        Add opportunity to dashboard feed.

        In production, this would store to Supabase dashboard_feed table.
        For now, returns success (dashboard polling will pick it up).
        """
        # TODO: Store to Supabase dashboard_feed table
        # await self.supabase.table('dashboard_feed').insert({
        #     "opportunity": opportunity,
        #     "tier": tier,
        #     "timestamp": datetime.now().isoformat()
        # })

        return {
            "success": True,
            "message": "Added to dashboard feed"
        }

    async def _log_alert_event(
        self,
        opportunity: Dict,
        tier: PriorityTier,
        channels_sent: List[str],
        channels_failed: List[str],
        errors: Dict
    ):
        """
        Log alert event for audit.

        In production, this would store to Supabase alert_logs table.
        """
        # TODO: Implement audit logging
        # from backend.logging.audit_logger import AuditLogger
        # logger = AuditLogger()
        # await logger.log_alert_sent(
        #     opportunity=opportunity,
        #     tier=tier,
        #     channels_sent=channels_sent,
        #     channels_failed=channels_failed,
        #     errors=errors
        # )

        pass

    async def send_batch_alerts(
        self,
        opportunities: List[Dict],
        tier: PriorityTier
    ) -> Dict:
        """
        Send alerts for multiple opportunities.

        Args:
            opportunities: List of opportunity dictionaries
            tier: Priority tier for all opportunities

        Returns:
            {
                "total": 10,
                "successful": 8,
                "failed": 2,
                "details": [...]
            }
        """
        results = {
            "total": len(opportunities),
            "successful": 0,
            "failed": 0,
            "details": []
        }

        # Send alerts in parallel (with concurrency limit)
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent alerts

        async def send_with_limit(opp):
            async with semaphore:
                return await self.send_alert(opp, tier)

        tasks = [send_with_limit(opp) for opp in opportunities]
        alert_results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(alert_results):
            if isinstance(result, Exception):
                results["failed"] += 1
                results["details"].append({
                    "opportunity_id": opportunities[i].get('id'),
                    "success": False,
                    "error": str(result)
                })
            elif result.get('success', False):
                results["successful"] += 1
                results["details"].append({
                    "opportunity_id": opportunities[i].get('id'),
                    "success": True,
                    "channels_sent": result['channels_sent']
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "opportunity_id": opportunities[i].get('id'),
                    "success": False,
                    "errors": result.get('errors', {})
                })

        return results


# Convenience function for quick alerts
async def send_alert(
    opportunity: Dict,
    tier: PriorityTier,
    channels: Optional[List[AlertChannel]] = None
) -> Dict:
    """
    Quick convenience function to send an alert.

    Args:
        opportunity: Opportunity details
        tier: Priority tier
        channels: Optional channel override

    Returns:
        Alert results
    """
    manager = AlertManager()
    return await manager.send_alert(opportunity, tier, channels)
