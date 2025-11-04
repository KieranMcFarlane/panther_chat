import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional
import os

class BrightDataClient:
    """Client for processing Bright Data MCP responses from Claude Code orchestration."""
    
    def __init__(self):
        self.api_key = os.getenv('BRIGHTDATA_API_KEY')
        print(f"Bright Data client initialized - API key available: {bool(self.api_key)}")
        
    def process_mcp_response(self, mcp_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process MCP response data from Claude Code orchestration"""
        try:
            # Extract data from MCP response
            if 'result' in mcp_data:
                # Handle successful MCP response
                result_data = mcp_data['result']
                return {
                    "source": "brightdata",
                    "data": {
                        "company": result_data.get('company_name', 'Unknown'),
                        "website": result_data.get('website', ''),
                        "recent_news": result_data.get('news', []),
                        "contacts": result_data.get('contacts', []),
                        "social_media": result_data.get('social_media', {}),
                        "status": "mcp_success",
                        "processed_at": datetime.now().isoformat()
                    }
                }
            elif 'error' in mcp_data:
                # Handle MCP error
                print(f"Bright Data MCP error: {mcp_data['error']}")
                return self._get_mock_data("Unknown", "company")
            else:
                # Handle unexpected format
                print(f"Unexpected MCP response format: {mcp_data}")
                return self._get_mock_data("Unknown", "company")
                
        except Exception as e:
            print(f"Error processing Bright Data MCP response: {e}")
            return self._get_mock_data("Unknown", "company")
    
    def fetch_company_data(self, entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
        """Fetch company data - this will be called by Claude Code MCP orchestration"""
        # For now, return mock data since Claude Code will handle the MCP calls
        # In production, this would receive data from Claude Code's MCP tool calls
        print(f"Bright Data client called for {entity_name} - Claude Code will orchestrate MCP")
        return self._get_mock_data(entity_name, entity_type)
    
    def _get_mock_data(self, entity_name: str, entity_type: str) -> Dict[str, Any]:
        """Fallback to mock data when MCP is not available"""
        return {
            "source": "brightdata",
            "data": {
                "company": entity_name,
                "website": f"https://www.{entity_name.lower().replace(' ', '')}.com",
                "recent_news": [
                    {"title": f"{entity_name} announces new strategic partnership", "date": "2025-08-15"},
                    {"title": f"{entity_name} reports strong quarterly results", "date": "2025-08-10"}
                ],
                "contacts": [
                    {"name": "CEO", "role": "Chief Executive Officer"},
                    {"name": "CTO", "role": "Chief Technology Officer"}
                ],
                "social_media": {
                    "twitter": f"@{entity_name.lower().replace(' ', '')}",
                    "linkedin": f"linkedin.com/company/{entity_name.lower().replace(' ', '')}"
                },
                "status": "mock_data",
                "note": "Claude Code will orchestrate real MCP calls"
            }
        }

# Global client instance
brightdata_client = BrightDataClient()

def fetch_company_data(entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
    """Main function to fetch company data"""
    return brightdata_client.fetch_company_data(entity_name, entity_type)

def process_brightdata_mcp_response(mcp_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process Bright Data MCP response from Claude Code"""
    return brightdata_client.process_mcp_response(mcp_data)

if __name__ == "__main__":
    # Test the client
    client = BrightDataClient()
    result = client.fetch_company_data("Tesla Inc")
    print(json.dumps(result, indent=2))
    
    # Test MCP response processing
    mock_mcp_response = {
        "result": {
            "company_name": "Manchester United",
            "website": "https://www.manutd.com",
            "news": [{"title": "New sponsorship deal", "date": "2025-08-15"}],
            "contacts": [{"name": "Richard Arnold", "role": "CEO"}],
            "social_media": {"twitter": "@ManUtd", "linkedin": "linkedin.com/company/manutd"}
        }
    }
    
    processed = client.process_mcp_response(mock_mcp_response)
    print("\nProcessed MCP response:")
    print(json.dumps(processed, indent=2))
