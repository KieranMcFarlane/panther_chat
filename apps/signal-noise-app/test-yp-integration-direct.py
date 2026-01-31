#!/usr/bin/env python3
"""
Direct test of Yellow Panther Integration
Tests the YP scoring and alert system without Ralph Loop validation
"""
import asyncio
import sys
import os

# Set demo mode
os.environ['DEMO_MODE'] = 'true'
os.environ['ALERTS_ENABLED'] = 'true'

# Add project to path
sys.path.insert(0, '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app')

from backend.yellow_panther_scorer import score_yp_fit
from backend.reasoning import analyze_reason_likelihood
from backend.alerts import AlertManager, PriorityTier

async def test_yp_integration():
    print("")
    print("🎯 Yellow Panther Integration Test")
    print("=" * 80)
    print("")

    # Simulate a validated signal from Ralph Loop
    signal = {
        'id': 'test_tottenham_20250131',
        'entity_id': 'tottenham',
        'entity_name': 'Tottenham Hotspur',
        'entity_type': 'club',
        'country': 'UK',
        'league': 'Premier League',
        'signal_category': 'MOBILE_APPS',
        'signal_type': 'RFP_DETECTED',
        'confidence': 0.92,
        'temporal_multiplier': 1.35,
        'evidence': [
            {
                'content': 'Tottenham seeking mobile app development partner',
                'source': 'Official Club Announcement',
                'credibility_score': 0.95
            },
            {
                'content': 'Budget: £350K for iOS and Android fan engagement app',
                'source': 'Budget Document',
                'credibility_score': 0.90
            },
            {
                'content': 'Features: ticketing, live updates, loyalty rewards, streaming',
                'source': 'RFP Document',
                'credibility_score': 0.92
            },
            {
                'content': 'Timeline: 12 months starting Q2 2025',
                'source': 'Project Schedule',
                'credibility_score': 0.88
            }
        ]
    }

    entity_context = {
        'name': 'Tottenham Hotspur',
        'type': 'club',
        'country': 'UK',
        'size': 'elite_mid'
    }

    print("📊 Step 1: Yellow Panther Fit Scoring")
    print("-" * 80)
    yp_fit = score_yp_fit(signal, entity_context)

    print(f"   Entity: {signal['entity_name']}")
    print(f"   Category: {signal['signal_category']}")
    print(f"   Fit Score: {yp_fit['fit_score']:.1f}/100")
    print(f"   Priority: {yp_fit['priority']}")
    print(f"   Budget Alignment: {yp_fit['budget_alignment']}")
    print(f"   Service Alignment: {', '.join(yp_fit['service_alignment'])}")
    print("")

    print("🧠 Step 2: Reason Likelihood Analysis")
    print("-" * 80)
    reasoning = analyze_reason_likelihood(signal, entity_context)

    print(f"   Primary Reason: {reasoning['primary_name']}")
    print(f"   Confidence: {reasoning['primary_confidence']:.0%}")
    print(f"   Urgency: {reasoning['urgency']}")
    print(f"   YP Solution Fit: {reasoning['yp_solution_fit']:.0%}")
    print("")

    print("📢 Step 3: Multi-Channel Alerts")
    print("-" * 80)

    # Build opportunity object
    opportunity = {
        'id': signal['id'],
        'entity_id': signal['entity_id'],
        'entity_name': signal['entity_name'],
        'entity_type': entity_context['type'],
        'country': entity_context['country'],
        'league': entity_context.get('league'),
        'category': signal['signal_category'],
        'signal_type': signal['signal_type'],
        'confidence': signal['confidence'],
        'temporal_multiplier': signal['temporal_multiplier'],
        'fit_score': yp_fit['fit_score'],
        'priority': yp_fit['priority'],
        'budget_alignment': yp_fit['budget_alignment'],
        'service_alignment': yp_fit['service_alignment'],
        'yp_advantages': yp_fit['yp_advantages'],
        'recommended_actions': yp_fit['recommended_actions'],
        'reasoning': reasoning,
        'evidence': signal['evidence'],
        'dashboard_url': f"https://signal-noise.com/entity/{signal['entity_id']}"
    }

    # Send alert
    alert_manager = AlertManager()
    tier = PriorityTier(yp_fit['priority'])

    print(f"   Sending {tier.value} alert...")
    result = await alert_manager.send_alert(opportunity, tier)

    print("")
    print(f"   Success: {result['success']}")
    print(f"   Channels Sent: {', '.join(result['channels_sent'])}")
    if result.get('errors'):
        print(f"   Errors: {result['errors']}")
    print("")

    print("=" * 80)
    print("✅ Yellow Panther Integration Test Complete!")
    print("")
    print("This demonstrates that when Ralph Loop validates a signal,")
    print("it will automatically:")
    print("  1. Score the signal for YP fit")
    print("  2. Analyze reasoning (WHY, urgency, YP solution fit)")
    print("  3. Send multi-channel alerts (Email, Webhook, Slack)")
    print("")

if __name__ == '__main__':
    asyncio.run(test_yp_integration())
