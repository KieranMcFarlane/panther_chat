import requests
import json
import logging
from typing import Dict, Any, Optional, List
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class PerplexityMCPClient:
    """Client for Perplexity MCP server integration"""
    
    def __init__(self):
        self.api_key = os.getenv('PERPLEXITY_API_KEY')
        self.base_url = "https://api.perplexity.ai"
        
        if not self.api_key:
            logger.warning("PERPLEXITY_API_KEY not found - will use mock data")
        
    def fetch_perplexity_summary(self, entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
        """Fetch AI-powered summary from Perplexity"""
        if not self.api_key:
            logger.info(f"No API key available, using mock data for {entity_name}")
            return self._get_mock_data(entity_name, entity_type)
            
        try:
            logger.info(f"Making Perplexity API request for {entity_name}")
            
            # Create a detailed prompt for business analysis
            system_prompt = f"""You are an AI business analyst specializing in {entity_type} research. 
            Analyze the given entity and provide structured business intelligence insights."""
            
            user_prompt = f"""Analyze {entity_name} and provide a comprehensive business analysis including:

1. **Business Summary**: Key business overview and market position
2. **Recent Developments**: Latest business news and strategic moves
3. **Financial Performance**: Key financial indicators and trends
4. **Strategic Initiatives**: Current projects and partnerships
5. **Market Position**: Competitive landscape and market share
6. **Key Opportunities**: Growth potential and expansion areas
7. **Risk Factors**: Main business risks and challenges

Format your response as a JSON object with these exact keys:
{{
    "summary": "concise business summary",
    "recent_developments": ["list", "of", "key", "developments"],
    "financial_performance": "financial overview",
    "strategic_initiatives": ["list", "of", "initiatives"],
    "market_position": "competitive position description",
    "opportunities": ["list", "of", "opportunities"],
    "risks": ["list", "of", "risks"]
}}

Focus on business intelligence, not just sports performance."""
            
            # Make real request to Perplexity API
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar-pro",
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ],
                    "max_tokens": 1500,
                    "temperature": 0.3,
                    "top_p": 0.9
                },
                timeout=45
            )
            
            logger.info(f"Perplexity API response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                
                logger.info(f"Perplexity response received for {entity_name}")
                
                # Try to parse JSON response
                try:
                    parsed_content = json.loads(content)
                    
                    # Validate required fields
                    required_fields = ["summary", "recent_developments", "financial_performance", 
                                     "strategic_initiatives", "market_position", "opportunities", "risks"]
                    
                    for field in required_fields:
                        if field not in parsed_content:
                            parsed_content[field] = "Information not available"
                    
                    return {
                        "source": "perplexity",
                        "status": "success",
                        "data": {
                            "summary": parsed_content.get("summary", "Analysis completed"),
                            "recent_developments": parsed_content.get("recent_developments", []),
                            "financial_performance": parsed_content.get("financial_performance", "Data not available"),
                            "strategic_initiatives": parsed_content.get("strategic_initiatives", []),
                            "market_position": parsed_content.get("market_position", "Position analysis completed"),
                            "opportunities": parsed_content.get("opportunities", []),
                            "risks": parsed_content.get("risks", []),
                            "raw_response": content,
                            "processed_at": datetime.now().isoformat()
                        }
                    }
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON response for {entity_name}: {e}")
                    logger.info(f"Raw response: {content[:200]}...")
                    
                    # Fallback to text parsing
                    return {
                        "source": "perplexity",
                        "status": "success",
                        "data": {
                            "summary": content[:500] + "..." if len(content) > 500 else content,
                            "recent_developments": ["Analysis completed - see summary"],
                            "financial_performance": "See summary for details",
                            "strategic_initiatives": ["Review summary for initiatives"],
                            "market_position": "Position analyzed - see summary",
                            "opportunities": ["Review summary for opportunities"],
                            "risks": ["Review summary for risks"],
                            "raw_response": content,
                            "note": "Response parsed as text due to JSON format issues",
                            "processed_at": datetime.now().isoformat()
                        }
                    }
            else:
                logger.error(f"Perplexity API request failed: {response.status_code}")
                logger.error(f"Response content: {response.text}")
                
                return {
                    "source": "perplexity",
                    "status": "error",
                    "error": f"API request failed with status {response.status_code}",
                    "data": self._get_mock_data(entity_name, entity_type)["data"]
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"Perplexity API request timed out for {entity_name}")
            return {
                "source": "perplexity",
                "status": "error",
                "error": "API request timed out",
                "data": self._get_mock_data(entity_name, entity_type)["data"]
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Perplexity API request failed for {entity_name}: {e}")
            return {
                "source": "perplexity",
                "status": "error",
                "error": f"Request failed: {str(e)}",
                "data": self._get_mock_data(entity_name, entity_type)["data"]
            }
        except Exception as e:
            logger.error(f"Unexpected error in Perplexity client for {entity_name}: {e}")
            return {
                "source": "perplexity",
                "status": "error",
                "error": f"Unexpected error: {str(e)}",
                "data": self._get_mock_data(entity_name, entity_type)["data"]
            }
    
    def _get_mock_data(self, entity_name: str, entity_type: str) -> Dict[str, Any]:
        """Fallback to mock data when API is unavailable"""
        return {
            "source": "perplexity",
            "status": "mock_data",
            "data": {
                "summary": f"{entity_name} is a leading {entity_type} with strong market presence and growth potential in the sports industry.",
                "recent_developments": [
                    f"{entity_name} announced new strategic partnerships",
                    f"Stadium expansion plans revealed",
                    "New sponsorship deals secured"
                ],
                "financial_performance": "Strong financial position with consistent revenue growth",
                "strategic_initiatives": [
                    "Digital transformation projects",
                    "International market expansion",
                    "Youth development programs"
                ],
                "market_position": f"{entity_name} maintains a strong competitive position in their league and market",
                "opportunities": [
                    "Digital revenue streams",
                    "International fan base expansion",
                    "Merchandising growth"
                ],
                "risks": [
                    "Market volatility",
                    "Competition intensification",
                    "Economic uncertainty"
                ],
                "note": "Mock data - API integration needed for real-time insights",
                "processed_at": datetime.now().isoformat()
            }
        }

# Global client instance
perplexity_client = PerplexityMCPClient()

def fetch_perplexity_summary(entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
    """Main function to fetch Perplexity summary"""
    return perplexity_client.fetch_perplexity_summary(entity_name, entity_type)

if __name__ == "__main__":
    # Test the client
    client = PerplexityMCPClient()
    
    # Test with a real entity
    result = client.fetch_perplexity_summary("Manchester United", "company")
    print("Perplexity Client Test Result:")
    print(json.dumps(result, indent=2))
    
    # Test error handling
    print("\n" + "="*50)
    print("Testing error handling...")
    
    # Test with invalid API key
    os.environ['PERPLEXITY_API_KEY'] = 'invalid_key'
    client_invalid = PerplexityMCPClient()
    result_invalid = client_invalid.fetch_perplexity_summary("Test Team", "company")
    print("Invalid API key test:")
    print(json.dumps(result_invalid, indent=2))
