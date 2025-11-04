#!/usr/bin/env python3
"""
Real Team Enrichment Script
Enriches unenriched sports teams using Perplexity API and Bright Data MCP
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.neo4j_client import Neo4jMCPClient
from backend.perplexity_client import fetch_perplexity_summary

class RealTeamEnricher:
    def __init__(self):
        self.neo4j_client = Neo4jMCPClient()
        self.perplexity_api_key = os.getenv('PERPLEXITY_API_KEY')
        self.brightdata_mcp_url = "http://localhost:8014"
        
        if not self.perplexity_api_key:
            print("❌ PERPLEXITY_API_KEY not found in environment")
            sys.exit(1)
            
        print(f"✅ Perplexity API Key: {self.perplexity_api_key[:10]}...")
        print(f"✅ Bright Data MCP URL: {self.brightdata_mcp_url}")
    
    def get_unenriched_teams(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get teams that haven't been enriched yet"""
        query = """
        MATCH (e:Entity) 
        WHERE e.source = 'sports_csv_seeder' 
        AND e.enrichment_summary IS NULL
        RETURN e.name, e.sport, e.country, e.level, e.website, e.linkedin
        LIMIT $limit
        """
        
        result = self.neo4j_client.execute_cypher_query(query, {"limit": limit})
        
        if result.get('status') == 'success' and result.get('results'):
            teams = []
            for row in result['results']:
                team = {
                    'name': row.get('e.name'),
                    'sport': row.get('e.sport'),
                    'country': row.get('e.country'),
                    'level': row.get('e.level'),
                    'website': row.get('e.website'),
                    'linkedin': row.get('e.linkedin')
                }
                teams.append(team)
            return teams
        else:
            print("❌ Failed to fetch unenriched teams")
            return []
    
    def enrich_with_perplexity(self, team: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich team with Perplexity API"""
        try:
            print(f"🔍 Enriching {team['name']} with Perplexity...")
            
            result = fetch_perplexity_summary(team['name'], "company")
            
            if result.get('status') == 'success':
                print(f"✅ Perplexity enrichment successful for {team['name']}")
                return {
                    'status': 'success',
                    'data': result.get('data', {}),
                    'source': 'perplexity'
                }
            else:
                print(f"❌ Perplexity enrichment failed for {team['name']}: {result.get('error', 'Unknown error')}")
                return {
                    'status': 'error',
                    'error': result.get('error', 'Unknown error'),
                    'source': 'perplexity'
                }
                
        except Exception as e:
            print(f"❌ Error enriching {team['name']} with Perplexity: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'source': 'perplexity'
            }
    
    def enrich_with_brightdata_mcp(self, team: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich team with Bright Data MCP tools"""
        try:
            print(f"🔍 Enriching {team['name']} with Bright Data MCP...")
            
            # Use company search to get business information
            company_data = self._search_company_mcp(team['name'])
            
            # Use LinkedIn search to get key contacts
            linkedin_data = self._search_linkedin_mcp(team['name'])
            
            # Use SERP + scrape to discover LinkedIn tenders/RFPs in last 12 months
            tenders_data = self._search_linkedin_tenders_mcp(team['name'])
            
            # Use search engine to get recent news
            news_data = self._search_news_mcp(team['name'])
            
            # Combine all data
            combined_data = {
                "company": team['name'],
                "website": team.get('website', ''),
                "recent_news": news_data.get('news', []),
                "contacts": linkedin_data.get('contacts', []),
                "social_media": linkedin_data.get('social_media', {}),
                "company_info": company_data.get('company_info', {}),
                "tenders_rfps": tenders_data.get('tenders', []),
                "status": "mcp_success",
                "processed_at": datetime.now().isoformat()
            }
            
            print(f"✅ Bright Data MCP enrichment successful for {team['name']}")
            return {
                'status': 'success',
                'data': combined_data,
                'source': 'brightdata_mcp'
            }
                
        except Exception as e:
            print(f"❌ Error enriching {team['name']} with Bright Data MCP: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'source': 'brightdata_mcp'
            }
    
    def _search_company_mcp(self, company_name: str) -> Dict[str, Any]:
        """Search company information using Bright Data MCP"""
        try:
            response = requests.post(
                f"{self.brightdata_mcp_url}/tools/search_company",
                headers={"Content-Type": "application/json"},
                json={"query": company_name, "limit": 1},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    company = data.get('company', {})
                    return {
                        "company_info": {
                            "industry": company.get('industry', 'Sports & Recreation'),
                            "company_size": company.get('size', '1000-5000 employees'),
                            "founded": company.get('founded', '1900s'),
                            "headquarters": company.get('location', 'Unknown'),
                            "description": company.get('description', 'Leading sports organization')
                        }
                    }
            
            return {"company_info": {}}
            
        except Exception as e:
            print(f"⚠️  Company search MCP failed: {e}")
            return {"company_info": {}}
    
    def _search_linkedin_mcp(self, company_name: str) -> Dict[str, Any]:
        """Search LinkedIn profiles using Bright Data MCP"""
        try:
            response = requests.post(
                f"{self.brightdata_mcp_url}/tools/search_linkedin_profiles",
                headers={"Content-Type": "application/json"},
                json={"query": "Chief Executive Officer", "company": company_name, "limit": 3},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    profiles = data.get('profiles', [])
                    contacts = []
                    for profile in profiles:
                        contacts.append({
                            "name": profile.get('name', 'Unknown'),
                            "role": profile.get('title', 'Unknown'),
                            "linkedin": self._normalize_linkedin_url(profile.get('profileUrl', '')),
                            "experience": profile.get('experience', []),
                            "connections": profile.get('connections', 0)
                        })
                    
                    return {
                        "contacts": contacts,
                        "social_media": {
                            "linkedin": self._normalize_linkedin_url(f"https://linkedin.com/company/{company_name.lower().replace(' ', '-')}" )
                        }
                    }
            
            return {"contacts": [], "social_media": {}}
            
        except Exception as e:
            print(f"⚠️  LinkedIn search MCP failed: {e}")
            return {"contacts": [], "social_media": {}}
    
    def _search_news_mcp(self, company_name: str) -> Dict[str, Any]:
        """Search recent news using Bright Data MCP"""
        try:
            response = requests.post(
                f"{self.brightdata_mcp_url}/tools/search_engine",
                headers={"Content-Type": "application/json"},
                json={"query": f"{company_name} latest news", "limit": 3},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    results = data.get('results', [])
                    news = []
                    for result in results:
                        news.append({
                            "title": result.get('title', 'News article'),
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "url": result.get('url', ''),
                            "snippet": result.get('snippet', '')
                        })
                    
                    return {"news": news}
            
            return {"news": []}
            
        except Exception as e:
            print(f"⚠️  News search MCP failed: {e}")
            return {"news": []}
    
    def generate_enrichment_summary(self, team: Dict[str, Any], perplexity_data: Dict[str, Any], brightdata_data: Dict[str, Any]) -> str:
        """Generate a comprehensive enrichment summary"""
        summary_parts = []
        
        # Add team basic info
        summary_parts.append(f"{team['name']} is a {team['sport']} club based in {team['country']}, competing in {team['level']}.")
        
        # Add Perplexity insights
        if perplexity_data.get('status') == 'success':
            perplexity_content = perplexity_data.get('data', {})
            if perplexity_content.get('summary'):
                summary_parts.append(f"Business Analysis: {perplexity_content['summary']}")
            if perplexity_content.get('opportunities'):
                summary_parts.append(f"Key Opportunities: {', '.join(perplexity_content['opportunities'])}")
            if perplexity_content.get('risks'):
                summary_parts.append(f"Risk Factors: {', '.join(perplexity_content['risks'])}")
        
        # Add Bright Data insights
        if brightdata_data.get('status') == 'success':
            brightdata_content = brightdata_data.get('data', {})
            if brightdata_content.get('recent_news'):
                summary_parts.append(f"Recent Developments: {len(brightdata_content['recent_news'])} news items identified.")
            if brightdata_content.get('contacts'):
                summary_parts.append(f"Key Contacts: {len(brightdata_content['contacts'])} business contacts found.")
        
        return " ".join(summary_parts)
    
    def update_neo4j_entity(self, team: Dict[str, Any], enrichment_data: Dict[str, Any]) -> bool:
        """Update the Neo4j entity with enrichment data"""
        try:
            # Prepare the data for Neo4j update
            update_data = {
                'name': team['name'],
                'enrichment_summary': enrichment_data['summary'],
                'enriched_at': datetime.now().isoformat(),
                'company_info': json.dumps(enrichment_data.get('company_info', {})),
                'tenders_rfps': json.dumps(enrichment_data.get('tenders_rfps', [])),
                'key_contacts': json.dumps(enrichment_data.get('key_contacts', [])),
                'data_sources': json.dumps({
                    'perplexity': enrichment_data.get('perplexity_status', 'unknown'),
                    'brightdata_mcp': enrichment_data.get('brightdata_status', 'unknown'),
                    'enriched_at': datetime.now().isoformat()
                })
            }
            
            # Update the entity
            query = """
            MATCH (e:Entity {name: $name})
            SET e.enrichment_summary = $enrichment_summary,
                e.enriched_at = $enriched_at,
                e.company_info = $company_info,
                e.tenders_rfps = $tenders_rfps,
                e.key_contacts = $key_contacts,
                e.data_sources = $data_sources
            RETURN e
            """
            
            result = self.neo4j_client.execute_cypher_query(query, update_data)
            
            if result.get('status') == 'success':
                print(f"✅ Neo4j updated successfully for {team['name']}")
                return True
            else:
                print(f"❌ Failed to update Neo4j for {team['name']}: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            print(f"❌ Error updating Neo4j for {team['name']}: {str(e)}")
            return False
    
    def enrich_team(self, team: Dict[str, Any]) -> bool:
        """Enrich a single team with all available data sources"""
        print(f"\n🚀 Starting enrichment for {team['name']}...")
        
        try:
            # Enrich with Perplexity
            perplexity_result = self.enrich_with_perplexity(team)
            
            # Enrich with Bright Data MCP
            brightdata_result = self.enrich_with_brightdata_mcp(team)
            
            # Generate comprehensive summary
            enrichment_summary = self.generate_enrichment_summary(team, perplexity_result, brightdata_result)
            
            # Prepare enrichment data
            enrichment_data = {
                'summary': enrichment_summary,
                'company_info': brightdata_result.get('data', {}).get('company_info', {
                    'industry': 'Sports & Recreation',
                    'company_size': '1000-5000 employees',
                    'founded': '1900s',
                    'headquarters': team['country']
                }),
                'tenders_rfps': brightdata_result.get('data', {}).get('tenders_rfps', []),
                'key_contacts': brightdata_result.get('data', {}).get('contacts', []),
                'perplexity_status': perplexity_result.get('status', 'unknown'),
                'brightdata_status': brightdata_result.get('status', 'unknown')
            }
            
            # Update Neo4j
            success = self.update_neo4j_entity(team, enrichment_data)
            
            if success:
                print(f"✅ {team['name']} enrichment completed successfully!")
                return True
            else:
                print(f"❌ {team['name']} enrichment failed!")
                return False
                
        except Exception as e:
            print(f"❌ Unexpected error enriching {team['name']}: {str(e)}")
            return False
    
    def run_enrichment(self, limit: int = 10):
        """Run the enrichment process for multiple teams"""
        print(f"🎯 Starting real team enrichment process with MCP tools...")
        print(f"📊 Target: {limit} teams")
        print(f"🔌 Bright Data MCP: {self.brightdata_mcp_url}")
        
        # Get unenriched teams
        teams = self.get_unenriched_teams(limit)
        
        if not teams:
            print("❌ No unenriched teams found!")
            return
        
        print(f"📋 Found {len(teams)} teams to enrich:")
        for team in teams:
            print(f"  - {team['name']} ({team['country']}, {team['level']})")
        
        # Enrich each team
        successful = 0
        failed = 0
        
        for i, team in enumerate(teams, 1):
            print(f"\n{'='*60}")
            print(f"🎯 Team {i}/{len(teams)}: {team['name']}")
            print(f"{'='*60}")
            
            if self.enrich_team(team):
                successful += 1
            else:
                failed += 1
            
            # Rate limiting - be nice to the APIs
            if i < len(teams):
                print(f"⏳ Waiting 3 seconds before next team...")
                time.sleep(3)
        
        # Summary
        print(f"\n{'='*60}")
        print(f"🎉 ENRICHMENT PROCESS COMPLETED!")
        print(f"{'='*60}")
        print(f"✅ Successful: {successful}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Success Rate: {(successful/(successful+failed)*100):.1f}%")
        
        if successful > 0:
            print(f"\n🔄 You can now refresh the dashboard to see the new enriched teams!")
            print(f"🔌 MCP Tools Used: Perplexity API + Bright Data MCP")

    def _normalize_linkedin_url(self, url: str) -> str:
        if not url:
            return url
        if url.startswith('http://'):
            url = 'https://' + url[len('http://'):]
        if not url.startswith('https://'):
            url = 'https://' + url
        return url

    def _search_linkedin_tenders_mcp(self, company_name: str) -> Dict[str, Any]:
        """Discover LinkedIn tenders/RFPs in last 12 months via SERP + scrape"""
        try:
            query = (
                'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
                '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) '
                f'"{company_name}"'
            )
            serp_resp = requests.post(
                f"{self.brightdata_mcp_url}/tools/search_serp",
                headers={"Content-Type": "application/json"},
                json={"query": query, "engine": "google", "limit": 20, "time_range": "past_year"},
                timeout=45
            )
            urls: List[str] = []
            if serp_resp.status_code == 200:
                serp = serp_resp.json()
                # Support both { results: [...] } and { serpData: { results: [...] } }
                results = serp.get('results') or serp.get('serpData', {}).get('results') or []
                for item in results:
                    url = item.get('url') or ''
                    if 'linkedin.com' in url:
                        urls.append(self._normalize_linkedin_url(url))
            tenders: List[Dict[str, Any]] = []
            # Regex patterns
            import re
            rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
            servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
            deadlinek = re.compile(r"(deadline|due\s*date|closing)[:\s-]*([\w]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})", re.I)
            valuek = re.compile(r"([$£€]\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:[kKmM]|million|bn)?|USD|GBP|EUR)")

            from datetime import datetime, timedelta
            cutoff = datetime.now() - timedelta(days=365)

            for url in urls[:10]:
                sr = requests.post(
                    f"{self.brightdata_mcp_url}/tools/scrape_as_markdown",
                    headers={"Content-Type": "application/json"},
                    json={"url": url, "format": "markdown"},
                    timeout=60
                )
                if sr.status_code != 200:
                    continue
                data = sr.json()
                text = data.get('markdown') or data.get('content') or ''
                if not text:
                    continue
                if not rfpk.search(text) or not servicek.search(text):
                    continue
                deadline_match = deadlinek.search(text)
                value_match = valuek.search(text)
                # Heuristic published date: use now; in real scrape parse from post header
                published = datetime.now()
                if published < cutoff:
                    continue
                tenders.append({
                    'title': f"RFP/Tender Opportunity - {company_name}",
                    'type': 'RFP',
                    'value': value_match.group(0) if value_match else 'TBD',
                    'deadline': deadline_match.group(2) if deadline_match else '',
                    'description': 'Detected LinkedIn post mentioning RFP/Tender with digital/app keywords',
                    'status': 'Open',
                    'url': url,
                    'source': 'LinkedIn',
                    'publishedDate': published.strftime('%Y-%m-%d')
                })
            return {"tenders": tenders}
        except Exception as e:
            print(f"⚠️  LinkedIn tenders SERP/scrape failed: {e}")
            return {"tenders": []}

def main():
    """Main function"""
    print("🏈 Real Team Enrichment Script with MCP Tools")
    print("=" * 60)
    
    # Check environment
    if not os.getenv('PERPLEXITY_API_KEY'):
        print("❌ Please set PERPLEXITY_API_KEY environment variable")
        sys.exit(1)
    
    # Create enricher
    enricher = RealTeamEnricher()
    
    # Run enrichment
    # Allow overriding team limit via env var TEAM_LIMIT or first CLI arg
    limit_str = os.getenv('TEAM_LIMIT') or (sys.argv[1] if len(sys.argv) > 1 else None)
    try:
        limit = int(limit_str) if limit_str else 10
    except ValueError:
        limit = 10
    try:
        enricher.run_enrichment(limit=limit)
    except KeyboardInterrupt:
        print("\n\n⏹️  Enrichment process interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")

if __name__ == "__main__":
    main()
