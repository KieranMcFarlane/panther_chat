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
        self.base_url = os.getenv("PERPLEXITY_MCP_URL", "http://localhost:3002")
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        self.timeout = int(os.getenv("PERPLEXITY_TIMEOUT", "30"))
        
        if not self.api_key:
            logger.warning("PERPLEXITY_API_KEY not set - using mock data")
    
    def fetch_perplexity_summary(self, entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
        """
        Fetch AI-powered summary and insights from Perplexity MCP server
        
        Args:
            entity_name: Name of the entity to research
            entity_type: Type of entity (company, person, etc.)
            
        Returns:
            Dict containing AI-generated insights and metadata
        """
        try:
            # Prepare the MCP request payload
            mcp_request = {
                "jsonrpc": "2.0",
                "id": f"pp_{datetime.utcnow().timestamp()}",
                "method": "perplexity.analyze_entity",
                "params": {
                    "entity_name": entity_name,
                    "entity_type": entity_type,
                    "analysis_options": {
                        "include_financial_analysis": True,
                        "include_market_position": True,
                        "include_competitive_landscape": True,
                        "include_risk_assessment": True,
                        "include_growth_potential": True,
                        "max_sources": 10,
                        "analysis_depth": "comprehensive"
                    }
                }
            }
            
            # Make the MCP call
            response = self._make_mcp_call(mcp_request)
            
            if response and response.get("result"):
                return self._process_perplexity_response(response["result"], entity_name, entity_type)
            else:
                logger.error(f"Perplexity MCP call failed: {response}")
                return self._get_mock_data(entity_name, entity_type)
                
        except Exception as e:
            logger.error(f"Error fetching Perplexity data for {entity_name}: {str(e)}")
            return self._get_mock_data(entity_name, entity_type)
    
    def _make_mcp_call(self, mcp_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make the actual MCP call to Perplexity server"""
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
                logger.error(f"Perplexity MCP HTTP error: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Perplexity MCP request failed: {str(e)}")
            return None
    
    def _process_perplexity_response(self, result: Dict[str, Any], entity_name: str, entity_type: str) -> Dict[str, Any]:
        """Process and structure the Perplexity response"""
        try:
            processed_data = {
                "source": "perplexity",
                "timestamp": datetime.utcnow().isoformat(),
                "entity_name": entity_name,
                "entity_type": entity_type,
                "ai_insights": {},
                "metadata": {}
            }
            
            # Extract AI insights
            if "financial_analysis" in result:
                processed_data["ai_insights"]["financial"] = {
                    "revenue_trends": result["financial_analysis"].get("revenue_trends"),
                    "profitability_metrics": result["financial_analysis"].get("profitability_metrics"),
                    "cash_flow_analysis": result["financial_analysis"].get("cash_flow_analysis"),
                    "financial_health_score": result["financial_analysis"].get("financial_health_score"),
                    "key_financial_ratios": result["financial_analysis"].get("key_ratios", {})
                }
            
            if "market_analysis" in result:
                processed_data["ai_insights"]["market"] = {
                    "market_position": result["market_analysis"].get("market_position"),
                    "market_share": result["market_analysis"].get("market_share"),
                    "target_markets": result["market_analysis"].get("target_markets", []),
                    "geographic_reach": result["market_analysis"].get("geographic_reach", []),
                    "market_trends": result["market_analysis"].get("market_trends", [])
                }
            
            if "competitive_analysis" in result:
                processed_data["ai_insights"]["competitive"] = {
                    "main_competitors": result["competitive_analysis"].get("main_competitors", []),
                    "competitive_advantages": result["competitive_analysis"].get("competitive_advantages", []),
                    "competitive_threats": result["competitive_analysis"].get("competitive_threats", []),
                    "swot_analysis": result["competitive_analysis"].get("swot_analysis", {})
                }
            
            if "risk_assessment" in result:
                processed_data["ai_insights"]["risk"] = {
                    "operational_risks": result["risk_assessment"].get("operational_risks", []),
                    "financial_risks": result["risk_assessment"].get("financial_risks", []),
                    "market_risks": result["risk_assessment"].get("market_risks", []),
                    "regulatory_risks": result["risk_assessment"].get("regulatory_risks", []),
                    "overall_risk_score": result["risk_assessment"].get("overall_risk_score")
                }
            
            if "growth_analysis" in result:
                processed_data["ai_insights"]["growth"] = {
                    "growth_drivers": result["growth_analysis"].get("growth_drivers", []),
                    "growth_barriers": result["growth_analysis"].get("growth_barriers", []),
                    "expansion_opportunities": result["growth_analysis"].get("expansion_opportunities", []),
                    "growth_potential_score": result["growth_analysis"].get("growth_potential_score"),
                    "projected_growth_rate": result["growth_analysis"].get("projected_growth_rate")
                }
            
            if "executive_summary" in result:
                processed_data["ai_insights"]["summary"] = {
                    "key_insights": result["executive_summary"].get("key_insights", []),
                    "strategic_recommendations": result["executive_summary"].get("strategic_recommendations", []),
                    "investment_outlook": result["executive_summary"].get("investment_outlook"),
                    "overall_assessment": result["executive_summary"].get("overall_assessment")
                }
            
            # Add metadata
            processed_data["metadata"] = {
                "analysis_timestamp": result.get("analysis_timestamp"),
                "sources_analyzed": result.get("sources_analyzed", 0),
                "analysis_duration": result.get("analysis_duration"),
                "confidence_score": result.get("confidence_score", 0.0),
                "model_version": result.get("model_version", "unknown")
            }
            
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing Perplexity response: {str(e)}")
            return self._get_mock_data(entity_name, entity_type)
    
    def _get_mock_data(self, entity_name: str, entity_type: str) -> Dict[str, Any]:
        """Return mock data when Perplexity is unavailable"""
        logger.info(f"Using mock Perplexity data for {entity_name}")
        
        return {
            "source": "perplexity_mock",
            "timestamp": datetime.utcnow().isoformat(),
            "entity_name": entity_name,
            "entity_type": entity_type,
            "ai_insights": {
                "financial": {
                    "revenue_trends": "Steady growth over the past 3 years",
                    "profitability_metrics": "Strong margins with 15% YoY growth",
                    "cash_flow_analysis": "Positive operating cash flow, healthy liquidity",
                    "financial_health_score": 8.5,
                    "key_financial_ratios": {
                        "debt_to_equity": "0.3",
                        "current_ratio": "2.1",
                        "roe": "18.5%"
                    }
                },
                "market": {
                    "market_position": "Market leader in their segment",
                    "market_share": "25% of total addressable market",
                    "target_markets": ["Enterprise", "Mid-market", "SMB"],
                    "geographic_reach": ["North America", "Europe", "Asia-Pacific"],
                    "market_trends": [
                        "Growing demand for digital transformation",
                        "Increased focus on sustainability",
                        "Rising competition from cloud-native players"
                    ]
                },
                "competitive": {
                    "main_competitors": [
                        "Competitor A - 20% market share",
                        "Competitor B - 15% market share",
                        "Competitor C - 10% market share"
                    ],
                    "competitive_advantages": [
                        "Strong brand recognition",
                        "Proprietary technology",
                        "Established customer relationships"
                    ],
                    "competitive_threats": [
                        "New market entrants with innovative solutions",
                        "Changing customer preferences",
                        "Regulatory changes"
                    ],
                    "swot_analysis": {
                        "strengths": ["Market leadership", "Technology advantage", "Strong financials"],
                        "weaknesses": ["Legacy systems", "Geographic concentration"],
                        "opportunities": ["Market expansion", "Product innovation", "Acquisitions"],
                        "threats": ["Competition", "Economic uncertainty", "Regulatory changes"]
                    }
                },
                "risk": {
                    "operational_risks": ["Supply chain disruptions", "Key personnel turnover"],
                    "financial_risks": ["Interest rate fluctuations", "Currency exposure"],
                    "market_risks": ["Economic downturn", "Technology disruption"],
                    "regulatory_risks": ["Data privacy regulations", "Industry compliance"],
                    "overall_risk_score": 6.5
                },
                "growth": {
                    "growth_drivers": [
                        "Digital transformation demand",
                        "International expansion",
                        "Product portfolio expansion"
                    ],
                    "growth_barriers": [
                        "Market saturation in core segments",
                        "Talent acquisition challenges",
                        "Regulatory complexity"
                    ],
                    "expansion_opportunities": [
                        "Emerging markets",
                        "Adjacent industries",
                        "Platform ecosystem development"
                    ],
                    "growth_potential_score": 7.8,
                    "projected_growth_rate": "12-15% annually"
                },
                "summary": {
                    "key_insights": [
                        f"{entity_name} demonstrates strong market position with solid financial fundamentals",
                        "Growth opportunities exist in international markets and adjacent industries",
                        "Competitive advantages provide sustainable differentiation",
                        "Risk factors are manageable with proper mitigation strategies"
                    ],
                    "strategic_recommendations": [
                        "Accelerate international expansion",
                        "Invest in R&D for next-generation products",
                        "Strengthen partnerships and ecosystem development",
                        "Enhance risk management frameworks"
                    ],
                    "investment_outlook": "Positive with moderate risk",
                    "overall_assessment": f"{entity_name} is well-positioned for continued growth with strong fundamentals and clear strategic direction."
                }
            },
            "metadata": {
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "sources_analyzed": 8,
                "analysis_duration": "45s",
                "confidence_score": 0.82,
                "model_version": "perplexity-7b-mock",
                "note": "Mock data - Perplexity integration not available"
            }
        }

# Convenience function for direct usage
def fetch_perplexity_summary(entity_name: str, entity_type: str = "company") -> Dict[str, Any]:
    """Convenience function to fetch Perplexity summary"""
    client = PerplexityMCPClient()
    return client.fetch_perplexity_summary(entity_name, entity_type)

if __name__ == "__main__":
    # Test the client
    client = PerplexityMCPClient()
    result = client.fetch_perplexity_summary("Tesla Inc")
    print(json.dumps(result, indent=2))
