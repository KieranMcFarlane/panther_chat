"""
Email Client - Send email alerts for RFP opportunities using Resend

Sends formatted email alerts to Yellow Panther with tier-based templates.
"""

import os
import asyncio
from typing import Dict, Optional
from datetime import datetime

import httpx


class EmailClient:
    """
    Send email alerts for RFP opportunities using Resend.

    Templates:
    - TIER_1: Immediate action required (urgent)
    - TIER_2: New opportunity available (high priority)
    - TIER_3: Daily digest (batch)
    - TIER_4: Weekly summary (low priority)

    Configuration (environment variables):
    - YELLOW_PANTHER_EMAIL: Recipient email address
    - RESEND_API_KEY: Resend API key
    - EMAIL_FROM: From address (default: noreply@signal-noise.com)
    """

    def __init__(self):
        """Initialize email client"""
        self.recipient = os.getenv(
            "YELLOW_PANTHER_EMAIL",
            "yellow-panther@yellowpanther.io"
        )
        self.from_address = os.getenv(
            "EMAIL_FROM",
            "noreply@signal-noise.com"
        )
        self.resend_key = os.getenv("RESEND_API_KEY")

        # Resend API endpoint
        self.resend_url = "https://api.resend.com/emails"

        # For demo/testing, log to console instead of sending
        self.demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"

    async def send_opportunity_alert(
        self,
        opportunity: Dict,
        tier: str,
        urgency: str = "high"
    ) -> Dict:
        """
        Send formatted email alert.

        Args:
            opportunity: Opportunity details
            tier: Priority tier (TIER_1, TIER_2, TIER_3, TIER_4)
            urgency: Urgency level (immediate, high, medium, low)

        Returns:
            {
                "success": bool,
                "message": str,
                "email_id": str (if sent),
                "error": str (if failed)
            }
        """
        try:
            # Compose email
            subject = self._compose_subject(opportunity, tier)
            body = self._compose_body(opportunity, tier, urgency)

            # Log email (for demo/testing)
            if self.demo_mode:
                print("\n" + "="*80)
                print(f"EMAIL ALERT ({tier})")
                print("="*80)
                print(f"To: {self.recipient}")
                print(f"Subject: {subject}")
                print(f"\n{body}")
                print("="*80 + "\n")

                return {
                    "success": True,
                    "message": "Email logged (demo mode)",
                    "email_id": f"demo_{datetime.now().timestamp()}"
                }

            # Send via Resend (production)
            if self.resend_key:
                return await self._send_via_resend(
                    to=self.recipient,
                    subject=subject,
                    body=body,
                    tier=tier
                )

            # Fallback: Log only
            print(f"\n[EMAIL] To: {self.recipient}, Subject: {subject}")
            return {
                "success": True,
                "message": "Email logged (no SendGrid key)",
                "email_id": f"log_{datetime.now().timestamp()}"
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _compose_subject(self, opportunity: Dict, tier: str) -> str:
        """Compose email subject line"""
        entity = opportunity.get('entity_name', 'Unknown Entity')
        category = opportunity.get('category', 'Unknown Category')
        fit_score = opportunity.get('fit_score', 0)

        if tier == "TIER_1":
            return f"🚨 URGENT: {entity} - {category} RFP (Fit: {fit_score:.0f}/100)"
        elif tier == "TIER_2":
            return f"⚡ HIGH PRIORITY: {entity} - {category} Opportunity (Fit: {fit_score:.0f}/100)"
        elif tier == "TIER_3":
            return f"📊 New Opportunity: {entity} - {category} (Fit: {fit_score:.0f}/100)"
        else:
            return f"📋 Opportunity Alert: {entity} - {category}"

    def _compose_body(self, opportunity: Dict, tier: str, urgency: str) -> str:
        """Compose email body with formatted sections"""
        entity = opportunity.get('entity_name', 'Unknown')
        category = opportunity.get('category', 'Unknown')
        fit_score = opportunity.get('fit_score', 0)
        confidence = opportunity.get('confidence', 0)
        multiplier = opportunity.get('temporal_multiplier', 1.0)
        budget_alignment = opportunity.get('budget_alignment', 'Unknown')
        service_alignment = opportunity.get('service_alignment', [])
        yp_advantages = opportunity.get('yp_advantages', [])
        recommended_actions = opportunity.get('recommended_actions', [])
        reasoning = opportunity.get('reasoning', {})
        evidence = opportunity.get('evidence', [])

        # Build sections
        sections = []

        # Header
        sections.append(self._header(tier, urgency))

        # Overview
        sections.append(self._overview_section(
            entity, category, fit_score, confidence, multiplier, budget_alignment
        ))

        # Service alignment
        if service_alignment:
            sections.append(self._service_alignment_section(service_alignment))

        # YP advantages
        if yp_advantages:
            sections.append(self._yp_advantages_section(yp_advantages))

        # Reasoning
        if reasoning:
            sections.append(self._reasoning_section(reasoning))

        # Evidence
        if evidence:
            sections.append(self._evidence_section(evidence))

        # Recommended actions
        if recommended_actions:
            sections.append(self._actions_section(recommended_actions))

        # Footer
        sections.append(self._footer(opportunity))

        return "\n\n".join(sections)

    def _header(self, tier: str, urgency: str) -> str:
        """Email header"""
        if tier == "TIER_1":
            return "🎯 URGENT: YELLOW PANTHER RFP OPPORTUNITY - IMMEDIATE ACTION REQUIRED"
        elif tier == "TIER_2":
            return "🎯 YELLOW PANTHER RFP OPPORTUNITY - HIGH PRIORITY"
        elif tier == "TIER_3":
            return "🎯 YELLOW PANTHER RFP OPPORTUNITY"
        else:
            return "🎯 YELLOW PANTHER RFP UPDATE"

    def _overview_section(
        self,
        entity: str,
        category: str,
        fit_score: float,
        confidence: float,
        multiplier: float,
        budget_alignment: str
    ) -> str:
        """Overview section"""
        return f"""📊 OPPORTUNITY OVERVIEW

Entity: {entity}
Category: {category}
Fit Score: {fit_score:.0f}/100
Confidence: {confidence:.0%}
Temporal Multiplier: {multiplier:.2f}
Budget Alignment: {budget_alignment}"""

    def _service_alignment_section(self, services: list) -> str:
        """Service alignment section"""
        services_list = "\n".join([f"  • {s}" for s in services])
        return f"""🔧 SERVICE ALIGNMENT

Yellow Panther services that match:

{services_list}"""

    def _yp_advantages_section(self, advantages: list) -> str:
        """YP competitive advantages section"""
        advantages_list = "\n".join([f"  • {adv}" for adv in advantages])
        return f"""💪 YELLOW PANTHER ADVANTAGES

Why YP is well-positioned:

{advantages_list}"""

    def _reasoning_section(self, reasoning: Dict) -> str:
        """Reason likelihood section"""
        primary = reasoning.get('primary', 'Unknown')
        primary_confidence = reasoning.get('primary_confidence', 0)
        urgency = reasoning.get('urgency', 'Unknown')
        yp_fit = reasoning.get('yp_solution_fit', 0)

        secondary = reasoning.get('secondary_reasons', [])
        secondary_list = "\n".join([
            f"  • {r.get('reason', 'Unknown')} ({r.get('confidence', 0):.0%})"
            for r in secondary[:3]
        ]) if secondary else "  • None"

        return f"""🧠 REASONING LIKELIHOOD

Primary Reason: {primary}
Confidence: {primary_confidence:.0%}
Urgency: {urgency}
YP Solution Fit: {yp_fit:.0%}

Secondary Reasons:
{secondary_list}"""

    def _evidence_section(self, evidence: list) -> str:
        """Evidence section"""
        evidence_list = "\n".join([
            f"  {i+1}. [{e.get('source', 'Unknown')}] {e.get('content', 'N/A')[:100]}..."
            for i, e in enumerate(evidence[:5])
        ])
        return f"""📎 EVIDENCE

{evidence_list}"""

    def _actions_section(self, actions: list) -> str:
        """Recommended actions section"""
        actions_list = "\n".join([f"  {i+1}. {action}" for i, action in enumerate(actions)])
        return f"""✅ RECOMMENDED ACTIONS

{actions_list}"""

    def _footer(self, opportunity: Dict) -> str:
        """Email footer"""
        entity_id = opportunity.get('entity_id', 'unknown')
        dashboard_url = opportunity.get(
            'dashboard_url',
            f"https://signal-noise.com/entity/{entity_id}"
        )

        return f"""---
View full details and track progress: {dashboard_url}

Signal Noise RFP Intelligence System
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"""

    async def _send_via_resend(
        self,
        to: str,
        subject: str,
        body: str,
        tier: str
    ) -> Dict:
        """Send email via Resend API"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.resend_url,
                    headers={
                        "Authorization": f"Bearer {self.resend_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": self.from_address,
                        "to": [to],
                        "subject": subject,
                        "text": body,
                        "tags": [
                            {"name": "category", "value": "rfp_opportunity"},
                            {"name": "priority", "value": tier},
                            {"name": "source", "value": "signal-noise-app"}
                        ]
                    },
                    timeout=30.0
                )

                if response.status_code in [200, 201, 202]:
                    result = response.json()
                    return {
                        "success": True,
                        "message": "Email sent via Resend",
                        "email_id": result.get('id', 'unknown')
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Resend error: {response.status_code}",
                        "details": response.text if response.content else None
                    }

        except httpx.TimeoutError:
            return {
                "success": False,
                "error": "Resend timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def send_digest(
        self,
        opportunities: list,
        digest_type: str = "daily"
    ) -> Dict:
        """
        Send digest email with multiple opportunities.

        Args:
            opportunities: List of opportunities for digest
            digest_type: "daily" or "weekly"

        Returns:
            Send results
        """
        try:
            # Compose digest email
            subject = f"📊 Yellow Panther RFP Digest - {digest_type.capitalize()}"

            body = f"""YELLOW PANTHER RFP INTELLIGENCE DIGEST
{digest_type.capitalize()} Summary: {len(opportunities)} opportunities

"""

            # Group by tier
            tier_1 = [opp for opp in opportunities if opp.get('priority') == 'TIER_1']
            tier_2 = [opp for opp in opportunities if opp.get('priority') == 'TIER_2']
            tier_3 = [opp for opp in opportunities if opp.get('priority') == 'TIER_3']

            if tier_1:
                body += f"\n🚨 CRITICAL ({len(tier_1)})\n"
                for opp in tier_1:
                    body += f"  • {opp.get('entity_name')}: {opp.get('category')} (Fit: {opp.get('fit_score', 0):.0f})\n"

            if tier_2:
                body += f"\n⚡ HIGH PRIORITY ({len(tier_2)})\n"
                for opp in tier_2:
                    body += f"  • {opp.get('entity_name')}: {opp.get('category')} (Fit: {opp.get('fit_score', 0):.0f})\n"

            if tier_3:
                body += f"\n📊 MEDIUM PRIORITY ({len(tier_3)})\n"
                for opp in tier_3:
                    body += f"  • {opp.get('entity_name')}: {opp.get('category')} (Fit: {opp.get('fit_score', 0):.0f})\n"

            body += f"""
---
View all opportunities: https://signal-noise.com/dashboard

Signal Noise RFP Intelligence System
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
"""

            # Log or send
            if self.demo_mode:
                print("\n" + "="*80)
                print(f"EMAIL DIGEST ({digest_type})")
                print("="*80)
                print(f"To: {self.recipient}")
                print(f"Subject: {subject}")
                print(f"\n{body}")
                print("="*80 + "\n")

                return {
                    "success": True,
                    "message": f"{digest_type.capitalize()} digest logged (demo mode)",
                    "opportunity_count": len(opportunities)
                }

            # Send via Resend if available
            if self.resend_key:
                return await self._send_via_resend(
                    to=self.recipient,
                    subject=subject,
                    body=body,
                    tier=f"{digest_type}_digest"
                )

            return {
                "success": True,
                "message": f"{digest_type.capitalize()} digest logged",
                "opportunity_count": len(opportunities)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
