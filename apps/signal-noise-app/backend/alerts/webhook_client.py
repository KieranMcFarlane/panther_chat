"""
Webhook Client - Real-time webhook integration with Yellow Panther

Sends real-time webhooks to Yellow Panther systems for immediate
opportunity notification.
"""

import os
import json
from typing import Dict, Optional
from datetime import datetime

import httpx


class WebhookClient:
    """
    Real-time webhook integration with Yellow Panther systems.

    Webhook payload includes:
    - Opportunity details
    - Reason likelihood scores
    - Temporal predictions
    - Entity relationship data
    - Action recommendations

    Configuration (environment variables):
    - YELLOW_PANTHER_WEBHOOK_URL: Webhook endpoint
    - YELLOW_PANTHER_WEBHOOK_KEY: Webhook auth key
    - WEBHOOK_TIMEOUT: Request timeout in seconds (default: 10)
    - WEBHOOK_RETRY_ATTEMPTS: Max retry attempts (default: 3)
    """

    def __init__(self):
        """Initialize webhook client"""
        # Default to internal webhook if not configured
        default_url = "http://localhost:3005/api/yellow-panther/webhook"
        if os.getenv("NODE_ENV") == "production":
            # In production, use the actual domain
            default_url = "https://signal-noise.com/api/yellow-panther/webhook"

        self.webhook_url = os.getenv("YELLOW_PANTHER_WEBHOOK_URL", default_url)
        self.webhook_key = os.getenv("YELLOW_PANTHER_WEBHOOK_KEY")
        self.timeout = int(os.getenv("WEBHOOK_TIMEOUT", "10"))
        self.max_retries = int(os.getenv("WEBHOOK_RETRY_ATTEMPTS", "3"))

        # For demo/testing, log to console instead of sending
        self.demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"

    async def send_webhook(
        self,
        opportunity: Dict,
        tier: str,
        retry_attempt: int = 0
    ) -> Dict:
        """
        Send webhook to Yellow Panther.

        Args:
            opportunity: Opportunity details
            tier: Priority tier (TIER_1, TIER_2, TIER_3, TIER_4)
            retry_attempt: Current retry attempt (internal)

        Returns:
            {
                "success": bool,
                "status_code": int (if sent),
                "response": dict (if sent),
                "error": str (if failed)
            }
        """
        # Check demo mode FIRST (before URL validation)
        if self.demo_mode:
            payload = self._build_payload(opportunity, tier)

            print("\n" + "="*80)
            print(f"WEBHOOK ({tier})")
            print("="*80)
            print(f"URL: {self.webhook_url or 'DEMO MODE - No URL configured'}")
            print(f"\nPayload:\n{json.dumps(payload, indent=2)}")
            print("="*80 + "\n")

            return {
                "success": True,
                "message": "Webhook logged (demo mode)",
                "payload": payload
            }

        # Check webhook URL (only in production mode)
        if not self.webhook_url:
            return {
                "success": False,
                "error": "YELLOW_PANTHER_WEBHOOK_URL not configured"
            }

        try:
            # Build webhook payload
            payload = self._build_payload(opportunity, tier)

            # Send webhook
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers=self._build_headers(),
                    timeout=self.timeout
                )

                if response.status_code in [200, 201, 202, 204]:
                    return {
                        "success": True,
                        "status_code": response.status_code,
                        "response": response.json() if response.content else {},
                        "message": "Webhook delivered successfully"
                    }
                else:
                    # Retry on server errors
                    if response.status_code >= 500 and retry_attempt < self.max_retries:
                        await self._backoff(retry_attempt)
                        return await self.send_webhook(
                            opportunity, tier, retry_attempt + 1
                        )

                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "error": f"Webhook rejected: {response.status_code}",
                        "response": response.text if response.content else None
                    }

        except httpx.TimeoutError:
            # Retry on timeout
            if retry_attempt < self.max_retries:
                await self._backoff(retry_attempt)
                return await self.send_webhook(
                    opportunity, tier, retry_attempt + 1
                )

            return {
                "success": False,
                "error": f"Webhook timeout after {self.timeout}s"
            }

        except httpx.HTTPError as e:
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _build_payload(self, opportunity: Dict, tier: str) -> Dict:
        """
        Build webhook payload with comprehensive opportunity data.

        Payload structure:
        {
            "event": "rfp_opportunity",
            "timestamp": "ISO timestamp",
            "priority": "TIER_1/TIER_2/TIER_3/TIER_4",
            "data": {
                "entity": {...},
                "opportunity": {...},
                "reasoning": {...},
                "timing": {...},
                "actions": [...],
                "yp_advantages": [...]
            }
        }
        """
        return {
            "event": "rfp_opportunity",
            "timestamp": datetime.now().isoformat(),
            "priority": tier,
            "data": {
                "entity": {
                    "id": opportunity.get('entity_id'),
                    "name": opportunity.get('entity_name'),
                    "type": opportunity.get('entity_type', 'club'),
                    "country": opportunity.get('country', 'Unknown'),
                    "league": opportunity.get('league', 'Unknown')
                },
                "opportunity": {
                    "category": opportunity.get('category'),
                    "signal_type": opportunity.get('signal_type', 'RFP_DETECTED'),
                    "fit_score": opportunity.get('fit_score'),
                    "confidence": opportunity.get('confidence'),
                    "temporal_multiplier": opportunity.get('temporal_multiplier'),
                    "budget_alignment": opportunity.get('budget_alignment'),
                    "service_alignment": opportunity.get('service_alignment', []),
                    "priority": tier
                },
                "reasoning": self._format_reasoning(
                    opportunity.get('reasoning', {})
                ),
                "timing": {
                    "seasonality": opportunity.get('seasonality', {}),
                    "recurrence": opportunity.get('recurrence', {}),
                    "momentum": opportunity.get('momentum', {}),
                    "prediction": opportunity.get('prediction', {})
                },
                "actions": opportunity.get('recommended_actions', []),
                "yp_advantages": opportunity.get('yp_advantages', []),
                "evidence": self._format_evidence(
                    opportunity.get('evidence', [])
                )
            },
            "meta": {
                "source": "signal-noise-app",
                "version": "1.0.0",
                "dashboard_url": opportunity.get(
                    'dashboard_url',
                    f"https://signal-noise.com/entity/{opportunity.get('entity_id')}"
                )
            }
        }

    def _format_reasoning(self, reasoning: Dict) -> Dict:
        """Format reasoning data for webhook"""
        if not reasoning:
            return {}

        return {
            "primary_reason": reasoning.get('primary'),
            "primary_confidence": reasoning.get('primary_confidence'),
            "urgency": reasoning.get('urgency'),
            "yp_solution_fit": reasoning.get('yp_solution_fit'),
            "secondary_reasons": [
                {
                    "reason": r.get('reason'),
                    "confidence": r.get('confidence')
                }
                for r in reasoning.get('secondary_reasons', [])
            ],
            "timeline": reasoning.get('likelihood_to_buy', {})
        }

    def _format_evidence(self, evidence: list) -> list:
        """Format evidence for webhook"""
        if not evidence:
            return []

        formatted = []
        for item in evidence:
            formatted.append({
                "content": item.get('content'),
                "source": item.get('source'),
                "credibility": item.get('credibility'),
                "url": item.get('url'),
                "timestamp": item.get('timestamp')
            })

        return formatted

    def _build_headers(self) -> Dict:
        """Build HTTP headers for webhook request"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "SignalNoise-Webhook/1.0"
        }

        # Add auth header if key configured
        if self.webhook_key:
            headers["Authorization"] = f"Bearer {self.webhook_key}"

        return headers

    async def _backoff(self, attempt: int):
        """Exponential backoff between retries"""
        import asyncio
        wait_time = 2 ** attempt  # 1s, 2s, 4s...
        await asyncio.sleep(wait_time)

    async def send_batch_webhooks(
        self,
        opportunities: list,
        tier: str
    ) -> Dict:
        """
        Send webhooks for multiple opportunities.

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
        import asyncio

        results = {
            "total": len(opportunities),
            "successful": 0,
            "failed": 0,
            "details": []
        }

        # Send webhooks in parallel (with concurrency limit)
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent webhooks

        async def send_with_limit(opp):
            async with semaphore:
                return await self.send_webhook(opp, tier)

        tasks = [send_with_limit(opp) for opp in opportunities]
        webhook_results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(webhook_results):
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
                    "status_code": result.get('status_code')
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "opportunity_id": opportunities[i].get('id'),
                    "success": False,
                    "error": result.get('error', 'Unknown error')
                })

        return results

    async def test_webhook(self) -> Dict:
        """
        Test webhook connectivity.

        Sends a test payload to verify webhook is working.

        Returns:
            Test results
        """
        test_payload = {
            "event": "test",
            "timestamp": datetime.now().isoformat(),
            "message": "Webhook connectivity test",
            "source": "signal-noise-app"
        }

        if not self.webhook_url:
            return {
                "success": False,
                "error": "YELLOW_PANTHER_WEBHOOK_URL not configured"
            }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.webhook_url,
                    json=test_payload,
                    headers=self._build_headers(),
                    timeout=self.timeout
                )

                return {
                    "success": response.status_code in [200, 201, 202, 204],
                    "status_code": response.status_code,
                    "response": response.json() if response.content else None
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
