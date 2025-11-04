#!/usr/bin/env python3
"""
Store LinkedIn RFP Demo Results in Supabase Database
This script takes the demo results and stores them in the existing rfp_opportunities table.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv
import httpx
import uuid

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")


class RFPDatabaseStorer:
    """Store RFP opportunities in Supabase database."""
    
    def __init__(self):
        self.supabase_url = SUPABASE_URL
        self.supabase_key = SUPABASE_ANON_KEY
        
        if not self.supabase_url or not self.supabase_key:
            raise Exception("Supabase credentials not found in environment")
    
    async def load_demo_results(self) -> Dict[str, Any]:
        """Load the most recent demo results."""
        demo_files = list((PROJECT_DIR / "logs").glob("linkedin-rfp-demo-*.json"))
        if not demo_files:
            raise Exception("No demo results found. Run the demo first.")
        
        latest_file = max(demo_files, key=lambda f: f.stat().st_mtime)
        print(f"📂 Loading demo results from: {latest_file}")
        
        with open(latest_file, 'r') as f:
            return json.load(f)
    
    def transform_rfp_for_database(self, rfp: Dict[str, Any]) -> Dict[str, Any]:
        """Transform RFP data for database storage."""
        # Generate unique ID
        rfp_id = str(uuid.uuid4())
        
        # Calculate scores (0-100)
        confidence = int(rfp.get("confidence_score", 0.8) * 100)
        yellow_panther_fit = int(rfp.get("ai_analysis", {}).get("yellow_panther_fit", {}).get("score", 0.8) * 100)
        
        # Determine urgency based on deadline
        deadline_str = rfp.get("deadline", "")
        urgency = "medium"
        if deadline_str:
            try:
                deadline = datetime.strptime(deadline_str, "%Y-%m-%d")
                days_until = (deadline - datetime.now()).days
                if days_until < 30:
                    urgency = "high"
                elif days_until > 90:
                    urgency = "low"
            except:
                pass
        
        return {
            "id": rfp_id,
            "title": rfp.get("title", ""),
            "organization": rfp.get("organization", ""),
            "description": rfp.get("description", ""),
            "value": rfp.get("value", ""),
            "deadline": rfp.get("deadline", None),
            "category": rfp.get("category", "Technology"),
            "source": "LinkedIn",
            "source_url": rfp.get("url", ""),
            "published": rfp.get("publication_date", None),
            "location": "United Kingdom",  # Default for demo
            "requirements": rfp.get("requirements", []),
            "yellow_panther_fit": yellow_panther_fit,
            "confidence": confidence,
            "urgency": urgency,
            "entity_id": rfp.get("entity_id", ""),
            "entity_name": rfp.get("organization", ""),
            "detected_at": datetime.now().isoformat(),
            "status": "new",
            "metadata": {
                "ai_analysis": rfp.get("ai_analysis", {}),
                "contact_email": rfp.get("contact_email", ""),
                "confidence_score": rfp.get("confidence_score", 0.8),
                "opportunity_type": rfp.get("ai_analysis", {}).get("opportunity_type", ""),
                "competition_level": rfp.get("ai_analysis", {}).get("competition_level", ""),
                "detected_by": "claude_agent_sdk_demo"
            },
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    
    async def store_rfp_opportunities(self, rfp_data: List[Dict[str, Any]]) -> List[str]:
        """Store RFP opportunities in Supabase."""
        stored_ids = []
        
        for rfp in rfp_data:
            # Transform for database
            db_record = self.transform_rfp_for_database(rfp)
            
            print(f"💾 Storing: {db_record['title'][:50]}...")
            
            # Insert into Supabase
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/rfp_opportunities",
                    headers=headers,
                    json=db_record
                )
                
                if response.status_code in [200, 201]:
                    stored_ids.append(db_record["id"])
                    print(f"   ✅ Stored successfully")
                else:
                    print(f"   ❌ Failed to store: {response.status_code} {response.text}")
        
        return stored_ids
    
    async def create_activity_feed_entries(self, rfp_data: List[Dict[str, Any]]):
        """Create activity feed entries for the new RFPs."""
        print("📝 Creating activity feed entries...")
        
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        for rfp in rfp_data:
            activity = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "type": "detection",
                "title": f"New RFP Detected: {rfp['organization']}",
                "description": f"{rfp['title']}",
                "entity_id": rfp.get("entity_id", ""),
                "entity_name": rfp.get("organization", ""),
                "urgency": "high" if rfp.get("confidence_score", 0) > 0.9 else "medium",
                "details": {
                    "value": rfp.get("value", ""),
                    "deadline": rfp.get("deadline", ""),
                    "category": rfp.get("category", ""),
                    "confidence": rfp.get("confidence_score", 0),
                    "source": "LinkedIn",
                    "source_url": rfp.get("url", "")
                },
                "actions": {
                    "view_rfp": f"/rfp-intelligence/{rfp.get('entity_id')}",
                    "research_organization": f"/entity-browser/{rfp.get('entity_id')}",
                    "create_alert": f"/api/alerts/create?entity={rfp.get('entity_id')}"
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/activity_feed",
                    headers=headers,
                    json=activity
                )
                
                if response.status_code in [200, 201]:
                    print(f"   ✅ Activity entry created for {rfp['organization']}")
                else:
                    print(f"   ⚠️  Activity entry failed: {response.status_code}")
    
    async def create_notifications(self, rfp_data: List[Dict[str, Any]]):
        """Create PWA notifications for high-value RFPs."""
        print("🔔 Creating notifications for high-value opportunities...")
        
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        high_value_rfps = [rfp for rfp in rfp_data if rfp.get("confidence_score", 0) > 0.9]
        
        for rfp in high_value_rfps:
            notification = {
                "id": str(uuid.uuid4()),
                "title": f"High-Value RFP: {rfp['organization']}",
                "body": f"{rfp['title']} - {rfp['value']}",
                "data": {
                    "type": "rfp_opportunity",
                    "entity_id": rfp.get("entity_id", ""),
                    "entity_name": rfp.get("organization", ""),
                    "rfp_title": rfp.get("title", ""),
                    "value": rfp.get("value", ""),
                    "deadline": rfp.get("deadline", ""),
                    "confidence": rfp.get("confidence_score", 0)
                },
                "icon": "/icons/rfp-icon.png",
                "badge": "/icons/badge.png",
                "tag": "rfp-opportunity",
                "require_interaction": True,
                "urgency_level": "high",
                "source_type": "rfp_detection",
                "entity_id": rfp.get("entity_id", ""),
                "entity_name": rfp.get("organization", ""),
                "actions": [
                    {
                        "action": "view",
                        "title": "View RFP",
                        "icon": "/icons/view.png"
                    },
                    {
                        "action": "research", 
                        "title": "Research Organization",
                        "icon": "/icons/research.png"
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/pwa_notifications",
                    headers=headers,
                    json=notification
                )
                
                if response.status_code in [200, 201]:
                    print(f"   🔔 Notification created for {rfp['organization']}")
                else:
                    print(f"   ⚠️  Notification failed: {response.status_code}")
    
    async def verify_database_integration(self) -> Dict[str, int]:
        """Verify the database integration by counting records."""
        print("🔍 Verifying database integration...")
        
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        counts = {}
        
        # Count RFP opportunities
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/rfp_opportunities?select=count",
                headers=headers
            )
            if response.status_code == 200:
                counts["rfp_opportunities"] = int(response.headers.get("content-range", "*/0").split("/")[1])
        
        # Count activity feed entries
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/activity_feed?select=count",
                headers=headers
            )
            if response.status_code == 200:
                counts["activity_feed"] = int(response.headers.get("content-range", "*/0").split("/")[1])
        
        # Count notifications
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/pwa_notifications?select=count",
                headers=headers
            )
            if response.status_code == 200:
                counts["pwa_notifications"] = int(response.headers.get("content-range", "*/0").split("/")[1])
        
        return counts
    
    async def run_integration(self):
        """Run the complete database integration."""
        print("🚀 Starting RFP Database Integration")
        print("=" * 40)
        
        # Load demo results
        demo_data = await self.load_demo_results()
        rfp_opportunities = demo_data.get("rfp_opportunities", [])
        
        print(f"📊 Found {len(rfp_opportunities)} RFP opportunities to store")
        
        # Store RFP opportunities
        stored_ids = await self.store_rfp_opportunities(rfp_opportunities)
        print(f"✅ Stored {len(stored_ids)} RFP opportunities")
        
        # Create activity feed entries
        await self.create_activity_feed_entries(rfp_opportunities)
        
        # Create notifications for high-value opportunities
        await self.create_notifications(rfp_opportunities)
        
        # Verify integration
        counts = await self.verify_database_integration()
        
        print(f"\n📈 Database Integration Summary:")
        print(f"   - RFP Opportunities: {counts.get('rfp_opportunities', 0)} total")
        print(f"   - Activity Feed Entries: {counts.get('activity_feed', 0)} total")
        print(f"   - PWA Notifications: {counts.get('pwa_notifications', 0)} total")
        
        print(f"\n✅ Database integration completed successfully!")
        print(f"   The RFP opportunities are now available in your Signal Noise App:")
        print(f"   - View in RFP Intelligence dashboard")
        print(f"   - Browse in Entity Browser")
        print(f"   - Receive real-time notifications")
        print(f"   - Track in activity feed")


async def main():
    """Main execution function."""
    try:
        storer = RFPDatabaseStorer()
        await storer.run_integration()
    except Exception as e:
        print(f"❌ Integration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())