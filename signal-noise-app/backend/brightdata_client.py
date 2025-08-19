import requests
import json
import logging
from typing import Dict, Any, Optional
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class BrightDataMCPClient:
    """Client for Bright Data MCP server integration"""
    
    def __init__(self):
        self.base_url = os.getenv("BRIGHTDATA_MCP_URL", "http://localhost:3001")
        self.api_key = os.getenv("BRIGHTDATA_API_KEY")
        self.timeout = int(os.getenv("BRIGHTDATA_TIMEOUT", "30"))
        
        if not self.api_key:
            logger.warning("BRIGHTDATA_API_KEY not set - using mock data")
    
    def fetch_company_data(self, company_name: str, entity_type: str = "company") -> Dict[str, Any]:
        """
        Fetch company data from Bright Data MCP server
        
        Args:
            company_name: Name of the company to research
            entity_type: Type of entity (company, person, etc.)
            
        Returns:
            Dict containing scraped data and metadata
        """
        try:
            # Prepare the MCP request payload
            mcp_request = {
                "jsonrpc": "2.0",
                "id": f"bd_{datetime.utcnow().timestamp()}",
                "method": "brightdata.scrape_company",
                "params": {
                    "company_name": company_name,
                    "entity_type": entity_type,
                    "scrape_options": {
                        "linkedin": True,
                        "company_website": True,
                        "news_mentions": True,
                        "social_media": True,
                        "max_pages": 5
                    }
                }
            }
            
            # Make the MCP call
            response = self._make_mcp_call(mcp_request)
            
            if response and response.get("result"):
                return self._process_brightdata_response(response["result"], company_name)
            else:
                logger.error(f"Bright Data MCP call failed: {response}")
                return self._get_mock_data(company_name, entity_type)
                
        except Exception as e:
            logger.error(f"Error fetching Bright Data for {company_name}: {str(e)}")
            return self._get_mock_data(company_name, entity_type)
    
    def _make_mcp_call(self, mcp_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make the actual MCP call to Bright Data server"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}" if self.api_key else "mock"
            }
            
            response = requests.post(
                f"{self.base_url}/mcp",
                json=mcp_request,
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Bright Data MCP HTTP error: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Bright Data MCP request failed: {str(e)}")
            return None
    
    def _process_brightdata_response(self, result: Dict[str, Any], company_name: str) -> Dict[str, Any]:
        """Process and structure the Bright Data response"""
        try:
            processed_data = {
                "source": "brightdata",
                "timestamp": datetime.utcnow().isoformat(),
                "company_name": company_name,
                "scraped_data": {},
                "metadata": {}
            }
            
            # Extract scraped data
            if "linkedin_data" in result:
                processed_data["scraped_data"]["linkedin"] = {
                    "company_page": result["linkedin_data"].get("company_page_url"),
                    "employee_count": result["linkedin_data"].get("employee_count"),
                    "industry": result["linkedin_data"].get("industry"),
                    "description": result["linkedin_data"].get("description"),
                    "founded": result["linkedin_data"].get("founded_year"),
                    "headquarters": result["linkedin_data"].get("headquarters")
                }
            
            if "website_data" in result:
                processed_data["scraped_data"]["website"] = {
                    "company_url": result["website_data"].get("company_url"),
                    "title": result["website_data"].get("title"),
                    "description": result["website_data"].get("meta_description"),
                    "technologies": result["website_data"].get("technologies", []),
                    "contact_info": result["website_data"].get("contact_info", {})
                }
            
            if "news_data" in result:
                processed_data["scraped_data"]["news"] = {
                    "mentions": result["news_data"].get("mentions", []),
                    "recent_articles": result["news_data"].get("recent_articles", []),
                    "sentiment": result["news_data"].get("overall_sentiment")
                }
            
            if "social_data" in result:
                processed_data["scraped_data"]["social"] = {
                    "twitter": result["social_data"].get("twitter", {}),
                    "facebook": result["social_data"].get("facebook", {}),
                    "instagram": result["social_data"].get("instagram", {})
                }
            
            # Add metadata
            processed_data["metadata"] = {
                "scrape_timestamp": result.get("scrape_timestamp"),
                "total_pages_scraped": result.get("total_pages_scraped", 0),
                "scrape_duration": result.get("scrape_duration"),
                "data_quality_score": result.get("data_quality_score", 0.0)
            }
            
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing Bright Data response: {str(e)}")
            return self._get_mock_data(company_name, "company")
    
    def _get_mock_data(self, company_name: str, entity_type: str) -> Dict[str, Any]:
        """Return mock data when Bright Data is unavailable"""
        logger.info(f"Using mock Bright Data for {company_name}")
        
        return {
            "source": "brightdata_mock",
            "timestamp": datetime.utcnow().isoformat(),
            "company_name": company_name,
            "scraped_data": {
                "linkedin": {
                    "company_page": f"https://linkedin.com/company/{company_name.lower().replace(' ', '-')}",
                    "employee_count": "1000-5000",
                    "industry": "Technology",
                    "description": f"Leading {entity_type} in the technology sector",
                    "founded": "2010",
                    "headquarters": "San Francisco, CA"
                },
                "website": {
                    "company_url": f"https://{company_name.lower().replace(' ', '')}.com",
                    "title": f"{company_name} - Official Website",
                    "description": f"Official website of {company_name}",
                    "technologies": ["React", "Node.js", "Python"],
                    "contact_info": {
                        "email": f"info@{company_name.lower().replace(' ', '')}.com",
                        "phone": "+1-555-0123"
                    }
                },
                "news": {
                    "mentions": [
                        f"{company_name} announces new product launch",
                        f"{company_name} reports strong Q4 earnings",
                        f"Industry analysts praise {company_name}'s innovation"
                    ],
                    "recent_articles": [
                        {
                            "title": f"{company_name} Expands Global Operations",
                            "url": f"https://news.example.com/{company_name.lower().replace(' ', '-')}-expansion",
                            "date": "2024-01-15"
                        }
                    ],
                    "sentiment": "positive"
                },
                "social": {
                    "twitter": {
                        "handle": f"@{company_name.lower().replace(' ', '')}",
                        "followers": "50000",
                        "verified": True
                    },
                    "facebook": {
                        "page": f"https://facebook.com/{company_name.lower().replace(' ', '')}",
                        "likes": "25000"
                    }
                }
            },
            "metadata": {
                "scrape_timestamp": datetime.utcnow().isoformat(),
                "total_pages_scraped": 3,
                "scrape_duration": "2.5s",
                "data_quality_score": 0.85,
                "note": "Mock data - Bright Data integration not available"
            }
        }

# Convenience function for direct usage
def fetch_company_data(company_name: str, entity_type: str = "company") -> Dict[str, Any]:
    """Convenience function to fetch company data"""
    client = BrightDataMCPClient()
    return client.fetch_company_data(company_name, entity_type)

if __name__ == "__main__":
    # Test the client
    client = BrightDataMCPClient()
    result = client.fetch_company_data("Tesla Inc")
    print(json.dumps(result, indent=2))
