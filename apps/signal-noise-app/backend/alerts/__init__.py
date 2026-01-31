"""
Alert System for Yellow Panther RFP Opportunities

Multi-channel alert system for notifying Yellow Panther about
high-fit RFP opportunities.

Channels:
- Email: Immediate notifications
- Webhook: Real-time push to Yellow Panther systems
- Slack: Team notifications
- Dashboard: Live feed
"""

from .alert_manager import AlertManager, PriorityTier, AlertChannel
from .email_client import EmailClient
from .webhook_client import WebhookClient
from .slack_client import SlackClient

__all__ = [
    'AlertManager',
    'PriorityTier',
    'AlertChannel',
    'EmailClient',
    'WebhookClient',
    'SlackClient'
]
