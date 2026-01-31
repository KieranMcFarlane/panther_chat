"""
Slack Client - Send Slack notifications for RFP opportunities

Sends formatted Slack notifications to Yellow Panther team channels.
"""

import os
from typing import Dict, Optional
from datetime import datetime

import httpx


class SlackClient:
    """
    Send Slack notifications for RFP opportunities.

    Formats notifications with Slack blocks for rich display.

    Configuration (environment variables):
    - SLACK_BOT_TOKEN: Slack bot token (xoxb-...)
    - SLACK_WORKSPACE: Slack workspace name
    - SLACK_CRITICAL_CHANNEL: Channel for TIER_1 alerts (default: #alerts-critical)
    - SLACK_OPPORTUNITIES_CHANNEL: Channel for TIER_2 alerts (default: #opportunities)
    - SLACK_DAILY_CHANNEL: Channel for daily digests (default: #daily-summary)
    - SLACK_WEEKLY_CHANNEL: Channel for weekly summaries (default: #weekly-summary)
    """

    def __init__(self):
        """Initialize Slack client"""
        self.bot_token = os.getenv("SLACK_BOT_TOKEN")
        self.workspace = os.getenv("SLACK_WORKSPACE", "yellow-panther")

        # Channel mappings
        self.critical_channel = os.getenv(
            "SLACK_CRITICAL_CHANNEL", "#alerts-critical"
        )
        self.opportunities_channel = os.getenv(
            "SLACK_OPPORTUNITIES_CHANNEL", "#opportunities"
        )
        self.daily_channel = os.getenv(
            "SLACK_DAILY_CHANNEL", "#daily-summary"
        )
        self.weekly_channel = os.getenv(
            "SLACK_WEEKLY_CHANNEL", "#weekly-summary"
        )

        # For demo/testing, log to console instead of sending
        self.demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"

    async def send_notification(
        self,
        channel: str,
        opportunity: Dict,
        tier: str
    ) -> Dict:
        """
        Send Slack notification to specified channel.

        Args:
            channel: Slack channel (e.g., #opportunities)
            opportunity: Opportunity details
            tier: Priority tier

        Returns:
            {
                "success": bool,
                "message": str,
                "timestamp": str,
                "error": str (if failed)
            }
        """
        # Check demo mode FIRST (before token validation)
        if self.demo_mode:
            blocks = self._build_message_blocks(opportunity, tier)

            print("\n" + "="*80)
            print(f"SLACK NOTIFICATION ({tier})")
            print("="*80)
            print(f"Channel: {channel}")
            print(f"\nMessage Blocks:")
            for block in blocks:
                block_type = block.get('type')
                if block_type == 'section':
                    text = block.get('text', {}).get('text', 'N/A')
                    print(f"  {block_type}: {text[:80]}...")
                elif block_type == 'header':
                    text = block.get('text', {}).get('text', 'N/A')
                    print(f"  {block_type}: {text}")
                else:
                    print(f"  {block_type}")
            print("="*80 + "\n")

            return {
                "success": True,
                "message": "Slack notification logged (demo mode)",
                "channel": channel,
                "timestamp": datetime.now().isoformat()
            }

        # Check bot token (only in production mode)
        if not self.bot_token:
            return {
                "success": False,
                "error": "SLACK_BOT_TOKEN not configured"
            }

        try:
            # Build Slack message with blocks
            blocks = self._build_message_blocks(opportunity, tier)

            # Send via Slack API
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={
                        "Authorization": f"Bearer {self.bot_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "channel": channel,
                        "blocks": blocks,
                        "unfurl_links": False,
                        "unfurl_media": False
                    },
                    timeout=10.0
                )

                data = response.json()

                if data.get('ok', False):
                    return {
                        "success": True,
                        "message": "Slack notification sent",
                        "channel": channel,
                        "timestamp": data.get('ts'),
                        "message_id": data.get('message', {}).get('ts')
                    }
                else:
                    return {
                        "success": False,
                        "error": data.get('error', 'Unknown Slack error')
                    }

        except httpx.TimeoutError:
            return {
                "success": False,
                "error": "Slack API timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _build_message_blocks(self, opportunity: Dict, tier: str) -> list:
        """
        Build Slack message blocks for rich formatting.

        Uses Slack Block Kit for structured messages.
        """
        entity = opportunity.get('entity_name', 'Unknown')
        category = opportunity.get('category', 'Unknown')
        fit_score = opportunity.get('fit_score', 0)
        confidence = opportunity.get('confidence', 0)
        multiplier = opportunity.get('temporal_multiplier', 1.0)
        budget_alignment = opportunity.get('budget_alignment', 'Unknown')
        service_alignment = opportunity.get('service_alignment', [])
        recommended_actions = opportunity.get('recommended_actions', [])
        reasoning = opportunity.get('reasoning', {})

        # Choose emoji based on tier
        tier_emoji = {
            "TIER_1": "🚨",
            "TIER_2": "⚡",
            "TIER_3": "📊",
            "TIER_4": "📋"
        }.get(tier, "📋")

        # Build blocks
        blocks = []

        # Header
        blocks.append({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{tier_emoji} RFP Opportunity: {entity}"
            }
        })

        # Divider
        blocks.append({"type": "divider"})

        # Section: Overview
        blocks.append({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Category:*\n{category}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Fit Score:*\n{fit_score:.0f}/100"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Confidence:*\n{confidence:.0%}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Temporal:*\n{multiplier:.2f}x"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Budget:*\n{budget_alignment}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Priority:*\n{tier}"
                }
            ]
        })

        # Service alignment (if available)
        if service_alignment:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Services:*\n{', '.join(service_alignment)}"
                }
            })

        # Reasoning (if available)
        if reasoning:
            primary = reasoning.get('primary', 'Unknown')
            primary_conf = reasoning.get('primary_confidence', 0)
            urgency = reasoning.get('urgency', 'Unknown')

            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Why:*\n{primary} ({primary_conf:.0%} confidence)\n_Urgency: {urgency}_"
                }
            })

        # Divider
        blocks.append({"type": "divider"})

        # Recommended actions (if available)
        if recommended_actions:
            actions_text = "\n".join([f"• {action}" for action in recommended_actions[:3]])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Next Actions:*\n{actions_text}"
                }
            })

        # Dashboard link
        entity_id = opportunity.get('entity_id', 'unknown')
        dashboard_url = opportunity.get(
            'dashboard_url',
            f"https://signal-noise.com/entity/{entity_id}"
        )

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"<{dashboard_url}|View details in dashboard>"
            }
        })

        # Footer with timestamp
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Signal Noise | {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                }
            ]
        })

        return blocks

    async def send_digest(
        self,
        opportunities: list,
        digest_type: str = "daily"
    ) -> Dict:
        """
        Send digest notification with multiple opportunities.

        Args:
            opportunities: List of opportunities for digest
            digest_type: "daily" or "weekly"

        Returns:
            Send results
        """
        try:
            # Choose channel
            if digest_type == "daily":
                channel = self.daily_channel
            else:
                channel = self.weekly_channel

            # Build digest message
            blocks = self._build_digest_blocks(opportunities, digest_type)

            # Log notification (for demo/testing)
            if self.demo_mode:
                print("\n" + "="*80)
                print(f"SLACK DIGEST ({digest_type})")
                print("="*80)
                print(f"Channel: {channel}")
                print(f"Opportunities: {len(opportunities)}")
                print("="*80 + "\n")

                return {
                    "success": True,
                    "message": f"Slack digest logged (demo mode)",
                    "channel": channel,
                    "opportunity_count": len(opportunities)
                }

            # Send via Slack API
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={
                        "Authorization": f"Bearer {self.bot_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "channel": channel,
                        "blocks": blocks,
                        "unfurl_links": False,
                        "unfurl_media": False
                    },
                    timeout=10.0
                )

                data = response.json()

                if data.get('ok', False):
                    return {
                        "success": True,
                        "message": f"{digest_type.capitalize()} Slack digest sent",
                        "channel": channel,
                        "timestamp": data.get('ts'),
                        "opportunity_count": len(opportunities)
                    }
                else:
                    return {
                        "success": False,
                        "error": data.get('error', 'Unknown Slack error')
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _build_digest_blocks(self, opportunities: list, digest_type: str) -> list:
        """Build Slack message blocks for digest"""
        blocks = []

        # Header
        emoji = "📊" if digest_type == "daily" else "📈"
        blocks.append({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} Yellow Panther RFP Digest - {digest_type.capitalize()}"
            }
        })

        # Divider
        blocks.append({"type": "divider"})

        # Summary
        tier_1_count = sum(1 for opp in opportunities if opp.get('priority') == 'TIER_1')
        tier_2_count = sum(1 for opp in opportunities if opp.get('priority') == 'TIER_2')
        tier_3_count = sum(1 for opp in opportunities if opp.get('priority') == 'TIER_3')

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Summary:* {len(opportunities)} opportunities\n"
                       f"🚨 Critical: {tier_1_count} | "
                       f"⚡ High: {tier_2_count} | "
                       f"📊 Medium: {tier_3_count}"
            }
        })

        # Divider
        blocks.append({"type": "divider"})

        # Group by tier
        tier_1 = [opp for opp in opportunities if opp.get('priority') == 'TIER_1']
        tier_2 = [opp for opp in opportunities if opp.get('priority') == 'TIER_2']
        tier_3 = [opp for opp in opportunities if opp.get('priority') == 'TIER_3']

        # TIER_1 opportunities
        if tier_1:
            tier_1_text = "\n".join([
                f"• {opp.get('entity_name')}: {opp.get('category')} "
                f"(Fit: {opp.get('fit_score', 0):.0f})"
                for opp in tier_1
            ])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🚨 *Critical ({len(tier_1)})*\n{tier_1_text}"
                }
            })

        # TIER_2 opportunities
        if tier_2:
            tier_2_text = "\n".join([
                f"• {opp.get('entity_name')}: {opp.get('category')} "
                f"(Fit: {opp.get('fit_score', 0):.0f})"
                for opp in tier_2
            ])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"⚡ *High Priority ({len(tier_2)})*\n{tier_2_text}"
                }
            })

        # TIER_3 opportunities (limit to 10 to avoid huge messages)
        if tier_3:
            tier_3_display = tier_3[:10]
            tier_3_text = "\n".join([
                f"• {opp.get('entity_name')}: {opp.get('category')} "
                f"(Fit: {opp.get('fit_score', 0):.0f})"
                for opp in tier_3_display
            ])
            if len(tier_3) > 10:
                tier_3_text += f"\n_... and {len(tier_3) - 10} more_"

            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"📊 *Medium Priority ({len(tier_3)})*\n{tier_3_text}"
                }
            })

        # Footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Signal Noise | {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                }
            ]
        })

        return blocks
