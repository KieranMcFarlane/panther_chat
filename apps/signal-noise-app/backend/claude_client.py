import requests
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class ClaudeCodeClient:
    """Client for Claude Code reasoning and signal synthesis"""
    
    def __init__(self):
        self.base_url = os.getenv("CLAUDE_CODE_URL", "http://localhost:3003")
        self.api_key = os.getenv("CLAUDE_CODE_API_KEY")
        self.timeout = int(os.getenv("CLAUDE_CODE_TIMEOUT", "60"))
        
        if not self.api_key:
            logger.warning("CLAUDE_CODE_API_KEY not set - using mock reasoning")
    
    def synthesize_signals(self, entity_name: str, entity_type: str, signals: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Synthesize signals from multiple sources using Claude Code reasoning
        
        Args:
            entity_name: Name of the entity
            entity_type: Type of entity (company, person, etc.)
            signals: Dictionary of signals from various sources
            
        Returns:
            Tuple of (summary, cypher_updates)
        """
        try:
            # Prepare the reasoning request
            reasoning_request = {
                "entity_name": entity_name,
                "entity_type": entity_type,
                "signals": signals,
                "reasoning_options": {
                    "include_cypher_generation": True,
                    "include_risk_assessment": True,
                    "include_opportunity_analysis": True,
                    "include_relationship_mapping": True,
                    "max_cypher_queries": 10
                }
            }
            
            # Make the reasoning call
            response = self._make_reasoning_call(reasoning_request)
            
            if response and response.get("result"):
                return self._process_reasoning_response(response["result"], entity_name)
            else:
                logger.error(f"Claude Code reasoning failed: {response}")
                return self._get_mock_reasoning(entity_name, entity_type, signals)
                
        except Exception as e:
            logger.error(f"Error in Claude Code reasoning for {entity_name}: {str(e)}")
            return self._get_mock_reasoning(entity_name, entity_type, signals)
    
    def generate_cypher_query(self, query: str, entity_context: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
        """
        Generate Cypher query from natural language using Claude Code
        
        Args:
            query: Natural language query
            entity_context: Optional entity context
            limit: Maximum number of results
            
        Returns:
            Dict containing generated Cypher query and explanation
        """
        try:
            # Prepare the Cypher reasoning request
            cypher_request = {
                "query": query,
                "entity_context": entity_context,
                "limit": limit,
                "reasoning_options": {
                    "include_explanation": True,
                    "include_alternatives": True,
                    "include_parameter_suggestions": True
                }
            }
            
            # Make the Cypher reasoning call
            response = self._make_cypher_reasoning_call(cypher_request)
            
            if response and response.get("result"):
                return self._process_cypher_response(response["result"])
            else:
                logger.error(f"Claude Code Cypher reasoning failed: {response}")
                return self._get_mock_cypher_reasoning(query, entity_context, limit)
                
        except Exception as e:
            logger.error(f"Error in Claude Code Cypher reasoning: {str(e)}")
            return self._get_mock_cypher_reasoning(query, entity_context, limit)
    
    def _make_reasoning_call(self, reasoning_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make the reasoning call to Claude Code server"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}" if self.api_key else "mock"
            }
            
            response = requests.post(
                f"{self.base_url}/reason/dossier",
                json=reasoning_request,
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Claude Code reasoning HTTP error: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Claude Code reasoning request failed: {str(e)}")
            return None
    
    def _make_cypher_reasoning_call(self, cypher_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make the Cypher reasoning call to Claude Code server"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}" if self.api_key else "mock"
            }
            
            response = requests.post(
                f"{self.base_url}/reason/cypher",
                json=cypher_request,
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Claude Code Cypher reasoning HTTP error: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Claude Code Cypher reasoning request failed: {str(e)}")
            return None
    
    def _process_reasoning_response(self, result: Dict[str, Any], entity_name: str) -> Tuple[str, List[Dict[str, Any]]]:
        """Process and structure the reasoning response"""
        try:
            # Extract summary
            summary = result.get("executive_summary", f"Analysis completed for {entity_name}")
            
            # Extract Cypher updates
            cypher_updates = []
            
            if "graph_updates" in result:
                for update in result["graph_updates"]:
                    cypher_update = {
                        "operation": update.get("operation", "MERGE"),
                        "cypher_query": update.get("cypher_query", ""),
                        "parameters": update.get("parameters", {}),
                        "description": update.get("description", "Graph update operation"),
                        "priority": update.get("priority", "normal")
                    }
                    cypher_updates.append(cypher_update)
            
            return summary, cypher_updates
            
        except Exception as e:
            logger.error(f"Error processing Claude Code reasoning response: {str(e)}")
            return f"Error in reasoning analysis for {entity_name}", []
    
    def _process_cypher_response(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Process and structure the Cypher reasoning response"""
        try:
            return {
                "cypher_query": result.get("cypher_query", ""),
                "explanation": result.get("explanation", ""),
                "confidence": result.get("confidence", 0.0),
                "suggested_parameters": result.get("suggested_parameters", {}),
                "alternatives": result.get("alternatives", []),
                "metadata": {
                    "model_version": result.get("model_version", "unknown"),
                    "processing_time": result.get("processing_time", 0.0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing Claude Code Cypher response: {str(e)}")
            return {
                "cypher_query": "",
                "explanation": "Error processing response",
                "confidence": 0.0,
                "suggested_parameters": {},
                "alternatives": []
            }
    
    def _get_mock_reasoning(self, entity_name: str, entity_type: str, signals: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
        """Return mock reasoning when Claude Code is unavailable"""
        logger.info(f"Using mock Claude Code reasoning for {entity_name}")
        
        # Generate mock summary based on available signals
        summary_parts = [f"Analysis completed for {entity_name} ({entity_type})"]
        
        if "brightdata" in signals:
            summary_parts.append("Web scraping data collected from multiple sources")
        
        if "perplexity" in signals:
            summary_parts.append("AI-powered market and financial analysis completed")
        
        summary = ". ".join(summary_parts) + "."
        
        # Generate mock Cypher updates
        cypher_updates = [
            {
                "operation": "MERGE",
                "cypher_query": f"MERGE (e:{entity_type.capitalize()} {{name: $entity_name}}) SET e.last_updated = datetime() RETURN e",
                "parameters": {"entity_name": entity_name},
                "description": f"Create or update {entity_type} node",
                "priority": "high"
            },
            {
                "operation": "MERGE",
                "cypher_query": f"MATCH (e:{entity_type.capitalize()} {{name: $entity_name}}) MERGE (s:Signal {{source: $source}}) MERGE (e)-[:HAS_SIGNAL]->(s) SET s.data = $data, s.timestamp = datetime()",
                "parameters": {"entity_name": entity_name, "source": "combined_analysis", "data": json.dumps(signals)},
                "description": "Create signal relationships",
                "priority": "normal"
            }
        ]
        
        return summary, cypher_updates
    
    def _get_mock_cypher_reasoning(self, query: str, entity_context: Optional[str], limit: int) -> Dict[str, Any]:
        """Return mock Cypher reasoning when Claude Code is unavailable"""
        logger.info(f"Using mock Claude Code Cypher reasoning for: {query}")
        
        # Simple mock Cypher generation based on query keywords
        query_lower = query.lower()
        
        if "connection" in query_lower or "relationship" in query_lower:
            cypher_query = f"MATCH (e)-[:CONNECTED_TO*1..3]-(related) RETURN related LIMIT {limit}"
        elif "financial" in query_lower or "revenue" in query_lower:
            cypher_query = f"MATCH (e)-[:HAS_FINANCIAL]->(f:Financial) RETURN f LIMIT {limit}"
        elif "competitor" in query_lower:
            cypher_query = f"MATCH (e)-[:COMPETES_WITH]->(c:Company) RETURN c LIMIT {limit}"
        else:
            cypher_query = f"MATCH (e) RETURN e LIMIT {limit}"
        
        return {
            "cypher_query": cypher_query,
            "explanation": f"Generated Cypher query for: {query}",
            "confidence": 0.75,
            "suggested_parameters": {"entity_name": entity_context or "entity"},
            "alternatives": [
                f"MATCH (e) WHERE e.name CONTAINS $search_term RETURN e LIMIT {limit}",
                f"MATCH (e)-[:RELATED_TO*1..2]-(related) RETURN related LIMIT {limit}"
            ],
            "metadata": {
                "model_version": "claude-3.5-sonnet-mock",
                "processing_time": 0.5,
                "note": "Mock reasoning - Claude Code integration not available"
            }
        }

# Convenience functions for direct usage
def synthesize_signals(entity_name: str, entity_type: str, signals: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """Convenience function to synthesize signals"""
    client = ClaudeCodeClient()
    return client.synthesize_signals(entity_name, entity_type, signals)

def generate_cypher_query(query: str, entity_context: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """Convenience function to generate Cypher query"""
    client = ClaudeCodeClient()
    return client.generate_cypher_query(query, entity_context, limit)

if __name__ == "__main__":
    # Test the client
    client = ClaudeCodeClient()
    
    # Test signal synthesis
    mock_signals = {
        "brightdata": {"source": "web_scraping", "data": {"employees": 1000}},
        "perplexity": {"source": "ai_analysis", "data": {"revenue": "$100M"}}
    }
    
    summary, updates = client.synthesize_signals("Tesla Inc", "company", mock_signals)
    print("Summary:", summary)
    print("Cypher Updates:", json.dumps(updates, indent=2))
    
    # Test Cypher generation
    cypher_result = client.generate_cypher_query("Find connections for Tesla", "Tesla Inc", 5)
    print("Cypher Result:", json.dumps(cypher_result, indent=2))
