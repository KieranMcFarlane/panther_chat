#!/bin/bash
# Yellow Panther Optimization - Quick Start Script
# Run this to test the complete Yellow Panther integration

echo "🎯 Yellow Panther RFP Intelligence System"
echo "==========================================="
echo ""

# Check if running in correct directory
if [ ! -f "backend/yellow_panther_scorer.py" ]; then
    echo "❌ Error: Run from signal-noise-app directory"
    exit 1
fi

# Step 1: Run unit tests
echo "🧪 Step 1: Running unit tests..."
echo "-------------------------------"
cd backend && python -m pytest tests/test_yellow_panther_scorer.py -v --tb=short 2>/dev/null
cd ..

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Check Python environment."
    exit 1
fi

echo ""
echo "✅ All tests passed!"
echo ""

# Step 2: Test alert system (demo mode)
echo "📧 Step 2: Testing alert system (demo mode)..."
echo "----------------------------------------------"
echo "Running test script..."
echo ""

DEMO_MODE=true python3 - << 'PYTHON_SCRIPT'
import asyncio
import sys
import os

# CRITICAL: Set demo mode BEFORE importing modules
os.environ['DEMO_MODE'] = 'true'
os.environ['ALERTS_ENABLED'] = 'true'

# Add project to path
sys.path.insert(0, os.getcwd())

from backend.alerts import AlertManager, PriorityTier
from backend.yellow_panther_scorer import score_yp_fit
from backend.reasoning import analyze_reason_likelihood

async def test_alerts():
    print("\n🎯 Creating test opportunity...")

    # Test opportunity 1: Mobile app (perfect fit)
    opportunity_1 = {
        "id": "test_tottenham_001",
        "entity_id": "tottenham",
        "entity_name": "Tottenham Hotspur",
        "entity_type": "club",
        "country": "UK",
        "league": "Premier League",
        "category": "MOBILE_APPS",
        "signal_category": "MOBILE_APPS",
        "signal_type": "RFP_DETECTED",
        "confidence": 0.90,
        "temporal_multiplier": 1.40,
        "evidence": [
            {
                "content": "Tottenham Hotspur seeking official mobile app development partner",
                "source": "Tender Notice",
                "credibility": 0.95
            },
            {
                "content": "Fan engagement mobile platform for iOS and Android",
                "source": "RFP Document",
                "credibility": 0.9
            },
            {
                "content": "Strategic initiative to enhance fan experience through mobile",
                "source": "Executive Announcement",
                "credibility": 0.85
            },
            {
                "content": "Budget: £200K-£300K for 6-month project",
                "source": "Budget Document",
                "credibility": 0.88
            }
        ]
    }

    print("\n📊 Scoring YP fit...")
    yp_fit = score_yp_fit(opportunity_1, {
        "name": "Tottenham Hotspur",
        "type": "club",
        "country": "UK",
        "size": "elite_mid"
    })
    opportunity_1.update(yp_fit)

    print(f"  Fit Score: {yp_fit['fit_score']:.0f}/100")
    print(f"  Priority: {yp_fit['priority']}")
    print(f"  Budget: {yp_fit['budget_alignment']}")
    print(f"  Services: {', '.join(yp_fit['service_alignment'])}")

    print("\n🧠 Analyzing reasoning...")
    reasoning = analyze_reason_likelihood(opportunity_1)
    opportunity_1['reasoning'] = reasoning

    print(f"  Primary: {reasoning['primary_name']} ({reasoning['primary_confidence']:.0%})")
    print(f"  Urgency: {reasoning['urgency']}")
    print(f"  YP Fit: {reasoning['yp_solution_fit']:.0%}")

    print("\n🚀 Sending alerts (TIER_1)...")
    manager = AlertManager()
    result = await manager.send_alert(
        opportunity_1,
        PriorityTier.TIER_1
    )

    print(f"\n✅ Alert Results:")
    print(f"  Success: {result['success']}")
    print(f"  Channels Sent: {', '.join(result['channels_sent'])}")
    if result['channels_failed']:
        print(f"  Channels Failed: {', '.join(result['channels_failed'])}")
    if result.get('errors'):
        print(f"  Errors: {result['errors']}")

    print("\n" + "="*80)
    print("✅ Test complete! Check console output above for alert details.")
    print("="*80)

asyncio.run(test_alerts())
PYTHON_SCRIPT

echo ""
echo "🎉 Quick start complete!"
echo ""
echo "Next steps:"
echo "1. Review alert output above"
echo "2. Configure .env with real API keys"
echo "3. Set DEMO_MODE=false for production"
echo "4. Read: YELLOW-PANTHER-IMPLEMENTATION-SUMMARY.md"
echo ""
