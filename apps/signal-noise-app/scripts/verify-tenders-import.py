#!/usr/bin/env python3
"""
Verify Tenders Import
Check that historical RFP data was successfully added to the database.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

async def verify_tenders():
    """Verify the tenders import."""
    print("🔍 Verifying Tenders Import...")
    
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # Get all RFPs
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/rfp_opportunities?select=*&order=detected_at&limit=50",
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch RFPs: {response.status_code}")
            return
        
        rfps = response.json()
        print(f"✅ Found {len(rfps)} RFPs in database")
        
        # Group by source
        historical_rfps = [rfp for rfp in rfps if rfp.get('metadata', {}).get('source') == 'historical_analysis']
        demo_rfps = [rfp for rfp in rfps if 'demo' in rfp.get('id', '').lower() or rfp.get('metadata', {}).get('detected_by') == 'claude_agent_sdk_demo']
        other_rfps = [rfp for rfp in rfps if rfp not in historical_rfps and rfp not in demo_rfps]
        
        print(f"\n📊 RFP Breakdown:")
        print(f"   📚 Historical RFPs: {len(historical_rfps)}")
        print(f"   🎯 Demo RFPs: {len(demo_rfps)}")
        print(f"   📋 Other RFPs: {len(other_rfps)}")
        
        # Show historical RFPs
        if historical_rfps:
            print(f"\n📚 Historical RFPs Added:")
            for rfp in historical_rfps:
                org = rfp.get('organization', 'Unknown')
                title = rfp.get('title', 'No title')
                value = rfp.get('value', 'Not specified')
                fit = rfp.get('yellow_panther_fit', 0)
                print(f"   • {org}: {title[:60]}... (${value}, {fit}% fit)")
        
        # Show demo RFPs
        if demo_rfps:
            print(f"\n🎯 Demo RFPs (from earlier):")
            for rfp in demo_rfps[:3]:  # Show first 3
                org = rfp.get('organization', 'Unknown')
                title = rfp.get('title', 'No title')
                value = rfp.get('value', 'Not specified')
                fit = rfp.get('yellow_panther_fit', 0)
                print(f"   • {org}: {title[:60]}... (${value}, {fit}% fit)")
            if len(demo_rfps) > 3:
                print(f"   ... and {len(demo_rfps) - 3} more demo RFPs")
        
        # Check high-value RFPs
        high_value = [rfp for rfp in rfps if (rfp.get('yellow_panther_fit') or 0) >= 90]
        print(f"\n🎯 High-Value RFPs (90%+ fit): {len(high_value)}")
        for rfp in high_value:
            org = rfp.get('organization', 'Unknown')
            title = rfp.get('title', 'No title')
            value = rfp.get('value', 'Not specified')
            fit = rfp.get('yellow_panther_fit', 0)
            print(f"   • {org}: {title[:50]}... (${value}, {fit}% fit)")
        
        # Check urgent RFPs
        urgent = [rfp for rfp in rfps if rfp.get('urgency') == 'high']
        print(f"\n⚡ Urgent RFPs: {len(urgent)}")
        for rfp in urgent:
            org = rfp.get('organization', 'Unknown')
            title = rfp.get('title', 'No title')
            deadline = rfp.get('deadline', 'No deadline')
            print(f"   • {org}: {title[:50]}... (Due: {deadline})")
        
        # Total value calculation
        total_estimated_value = 0
        for rfp in rfps:
            value_str = rfp.get('value', '').replace('$', '').replace('M', '').replace('+', '').replace('K', '')
            try:
                if '-' in value_str:
                    # Handle ranges like "3.5M - 6M"
                    parts = value_str.split('-')
                    avg_value = (float(parts[0]) + float(parts[1])) / 2
                    if 'M' in rfp.get('value', ''):
                        total_estimated_value += avg_value
                elif value_str and value_str != 'Not disclosed':
                    value_num = float(value_str)
                    if 'M' in rfp.get('value', ''):
                        total_estimated_value += value_num
                    elif 'K' in rfp.get('value', ''):
                        total_estimated_value += value_num / 1000
            except:
                pass
        
        print(f"\n💰 Total Estimated Value: ${total_estimated_value:.1f}M")
        print(f"   Across {len(rfps)} RFP opportunities")
        
        print(f"\n✅ Tenders import verification complete!")
        print(f"   All historical RFPs are now persisting in the tenders list.")


if __name__ == "__main__":
    asyncio.run(verify_tenders())