#!/usr/bin/env python3
"""
Clean RFP Database - Keep only RFPs with valid URLs
This script removes RFPs with invalid URLs from the database.
"""

import asyncio
import httpx
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv
import uuid

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

class RFPCleaner:
    """Clean RFP database by removing entries with invalid URLs."""
    
    def __init__(self):
        self.supabase_url = SUPABASE_URL
        self.supabase_key = SUPABASE_ANON_KEY
        
        if not self.supabase_url or not self.supabase_key:
            raise Exception("Supabase credentials not found in environment")
    
    async def check_url_validity(self, url: str, timeout: int = 10) -> Dict[str, Any]:
        """Check if a URL is valid."""
        if not url or url == '':
            return {
                'valid': False,
                'status_code': None,
                'error': 'No URL provided'
            }
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.head(url, follow_redirects=True)
                return {
                    'valid': response.status_code in [200, 201, 202],
                    'status_code': response.status_code,
                    'error': None
                }
        except Exception as e:
            return {
                'valid': False,
                'status_code': None,
                'error': str(e)[:100]
            }
    
    async def get_all_rfps(self) -> List[Dict[str, Any]]:
        """Get all RFPs from the database."""
        print("🔍 Fetching all RFPs from database...")
        
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.supabase_url}/rest/v1/rfp_opportunities?select=id,title,organization,source_url,status,source&limit=100",
                headers=headers
            )
            
            if response.status_code == 200:
                rfps = response.json()
                print(f"   Found {len(rfps)} RFPs")
                return rfps
            else:
                print(f"   ❌ Failed to fetch RFPs: {response.status_code}")
                return []
    
    async def update_url_status(self, rfp_id: str, is_valid: bool, status_code: int = None, error: str = None):
        """Update URL verification status in the database."""
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        update_data = {
            "link_status": "valid" if is_valid else "invalid",
            "link_verified_at": datetime.now().isoformat(),
            "link_error": error
        }
        
        if status_code:
            update_data["link_status_code"] = status_code
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.supabase_url}/rest/v1/rfp_opportunities?id=eq.{rfp_id}",
                headers=headers,
                json=update_data
            )
            
            if response.status_code in [200, 204]:
                return True
            else:
                print(f"   ⚠️  Failed to update URL status: {response.status_code}")
                return False
    
    async def delete_rfp(self, rfp_id: str, organization: str, reason: str):
        """Delete an RFP from the database."""
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.supabase_url}/rest/v1/rfp_opportunities?id=eq.{rfp_id}",
                headers=headers
            )
            
            if response.status_code in [200, 204]:
                print(f"     🗑️  Deleted: {organization} ({reason})")
                return True
            else:
                print(f"     ❌ Failed to delete: {organization} ({response.status_code})")
                return False
    
    async def clean_database(self, dry_run: bool = False):
        """Clean the database by removing RFPs with invalid URLs."""
        print("🧹 Starting RFP database cleanup...")
        print("=" * 60)
        
        # Get all RFPs
        rfps = await self.get_all_rfps()
        if not rfps:
            print("No RFPs found in database.")
            return
        
        valid_count = 0
        invalid_count = 0
        deleted_count = 0
        
        # Check each RFP's URL
        for rfp in rfps:
            organization = rfp.get('organization', 'Unknown')
            url = rfp.get('source_url', '')
            rfp_id = rfp.get('id')
            
            print(f"\\n🔍 Checking: {organization}")
            print(f"   URL: {url}")
            
            # Check URL validity
            url_check = await self.check_url_validity(url)
            
            if url_check['valid']:
                print(f"   ✅ VALID (Status: {url_check['status_code']})")
                valid_count += 1
                
                # Update URL status to valid
                if not dry_run:
                    await self.update_url_status(
                        rfp_id, 
                        True, 
                        url_check['status_code']
                    )
                
            else:
                print(f"   ❌ INVALID ({url_check.get('error', 'Unknown error')})")
                invalid_count += 1
                
                # Delete the invalid RFP
                if not dry_run:
                    reason = url_check.get('error', 'Invalid URL')
                    deleted = await self.delete_rfp(rfp_id, organization, reason)
                    if deleted:
                        deleted_count += 1
        
        # Summary
        print("\\n" + "=" * 60)
        print("📊 CLEANUP SUMMARY:")
        print(f"   ✅ Valid URLs kept: {valid_count}")
        print(f"   ❌ Invalid URLs found: {invalid_count}")
        print(f"   🗑️  RFPs deleted: {deleted_count}")
        print(f"   📈 Success rate: {(valid_count / len(rfps) * 100):.1f}%")
        
        if dry_run:
            print("\\n🔍 DRY RUN MODE - No changes made to database")
            print("   Run without --dry-run to actually delete invalid RFPs")
        else:
            print("\\n✅ DATABASE CLEANUP COMPLETED")
            print("   All RFPs with invalid URLs have been removed")
    
    async def verify_cleanup(self):
        """Verify the cleanup results."""
        print("\\n🔍 Verifying cleanup results...")
        
        rfps = await self.get_all_rfps()
        
        if rfps:
            print(f"   📊 Remaining RFPs: {len(rfps)}")
            print("   📋 Organizations:")
            for rfp in rfps:
                print(f"      • {rfp.get('organization', 'Unknown')}")
        else:
            print("   ⚠️  No RFPs remaining in database")


async def main():
    """Main execution function."""
    dry_run = "--dry-run" in sys.argv
    
    try:
        cleaner = RFPCleaner()
        
        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()
        
        await cleaner.clean_database(dry_run=dry_run)
        
        if not dry_run:
            await cleaner.verify_cleanup()
        
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())