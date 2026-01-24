import requests
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import os
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# Model Cascade Configuration
# =============================================================================

@dataclass
class ModelConfig:
    """Configuration for a Claude model"""
    name: str
    model_id: str
    max_tokens: int = 4096
    cost_per_million_tokens: float = 0.0


class ModelRegistry:
    """Registry of available Claude models with pricing"""

    MODELS = {
        "haiku": ModelConfig(
            name="haiku",
            model_id="claude-3-5-haiku-20241022",
            max_tokens=8192,
            cost_per_million_tokens=0.25  # $0.25/M input tokens
        ),
        "sonnet": ModelConfig(
            name="sonnet",
            model_id="claude-3-5-sonnet-20241022",
            max_tokens=8192,
            cost_per_million_tokens=3.0  # $3.0/M input tokens
        ),
        "opus": ModelConfig(
            name="opus",
            model_id="claude-3-opus-20240229",
            max_tokens=4096,
            cost_per_million_tokens=15.0  # $15.0/M input tokens
        )
    }

    @classmethod
    def get_model(cls, model_name: str) -> Optional[ModelConfig]:
        """Get model configuration by name"""
        return cls.MODELS.get(model_name)

    @classmethod
    def get_all_models(cls) -> Dict[str, ModelConfig]:
        """Get all available models"""
        return cls.MODELS


# =============================================================================
# Claude Client with Model Cascade
# =============================================================================

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


class ClaudeClient:
    """
    Claude API client with model cascade support

    Implements Haiku → Sonnet → Opus cascade for cost/latency optimization.

    Strategy:
    - Scraping: Sonnet (quality critical)
    - Validation: Sonnet (complex reasoning)
    - Synthesis: Opus (rare, critical insights)
    - Copilot reasoning: Haiku → Sonnet fallback

    Model cascade fallback:
    1. Try Haiku first (fastest, cheapest)
    2. If insufficient, fallback to Sonnet
    3. If still insufficient, fallback to Opus
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        Initialize Claude client

        Args:
            api_key: Anthropic API key (default: from ANTHROPIC_API_KEY env)
            base_url: Custom base URL (default: from ANTHROPIC_BASE_URL env)
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.base_url = base_url or os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

        if not self.api_key:
            logger.warning("⚠️ ANTHROPIC_API_KEY not set - client will fail")

        self.default_model = "haiku"
        self.cascade_order = ["haiku", "sonnet", "opus"]

        logger.info(f"🤖 ClaudeClient initialized (default: {self.default_model})")

    async def query_with_cascade(
        self,
        prompt: str,
        max_tokens: int = 2000,
        tools: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query Claude with model cascade fallback

        Tries models in order (haiku → sonnet → opus) until one produces a sufficient result.

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            tools: Optional list of tools for tool use
            system_prompt: Optional system prompt

        Returns:
            Response dict with:
            - content: Generated content
            - model_used: Which model succeeded
            - confidence: Confidence in result (0.0-1.0)
            - tool_results: Results of tool use (if any)
            - tokens_used: Input/output tokens
        """
        for model_name in self.cascade_order:
            try:
                logger.info(f"🔄 Trying model: {model_name}")

                result = await self._query(
                    prompt=prompt,
                    model=model_name,
                    max_tokens=max_tokens,
                    tools=tools,
                    system_prompt=system_prompt
                )

                # Check if result is sufficient
                if self._is_sufficient(result):
                    logger.info(f"✅ {model_name} sufficient for query")
                    result["model_used"] = model_name
                    result["cascade_attempts"] = self.cascade_order.index(model_name) + 1
                    return result
                else:
                    logger.warning(f"⚠️ {model_name} insufficient, escalating...")
                    continue

            except Exception as e:
                logger.error(f"❌ {model_name} failed: {e}")
                continue

        # All models failed
        raise Exception("All models in cascade failed")

    async def query(
        self,
        prompt: str,
        model: str = "haiku",
        max_tokens: int = 2000,
        tools: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query Claude with specific model

        Args:
            prompt: User prompt
            model: Model name (haiku, sonnet, opus)
            max_tokens: Maximum tokens to generate
            tools: Optional list of tools
            system_prompt: Optional system prompt

        Returns:
            Response dict with content, tokens_used, etc.
        """
        model_config = ModelRegistry.get_model(model)

        if not model_config:
            raise ValueError(f"Unknown model: {model}")

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        # Build request body
        body = {
            "model": model_config.model_id,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }

        if system_prompt:
            body["system"] = system_prompt

        if tools:
            body["tools"] = tools

        try:
            response = requests.post(
                f"{self.base_url}/v1/messages",
                headers=headers,
                json=body,
                timeout=60
            )

            response.raise_for_status()
            result = response.json()

            # Extract content
            content = result.get("content", [])
            text_blocks = [block.get("text", "") for block in content if block.get("type") == "text"]

            return {
                "content": "\n".join(text_blocks),
                "model_used": model,
                "raw_response": result,
                "tokens_used": result.get("usage", {}),
                "stop_reason": result.get("stop_reason")
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Claude API request failed: {e}")
            raise

    def _is_sufficient(self, result: Dict[str, Any]) -> bool:
        """
        Check if result is sufficient

        Criteria:
        - Has content
        - Content length > 50 chars
        - No errors
        """
        content = result.get("content", "")

        if not content:
            return False

        if len(content) < 50:
            return False

        if "error" in result or result.get("stop_reason") == "max_tokens":
            return False

        return True


# =============================================================================
# Convenience Functions
# =============================================================================

async def query_with_cascade(
    prompt: str,
    max_tokens: int = 2000,
    tools: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to query Claude with model cascade

    Args:
        prompt: User prompt
        max_tokens: Maximum tokens to generate
        tools: Optional list of tools
        system_prompt: Optional system prompt

    Returns:
        Response from Claude with cascade fallback
    """
    client = ClaudeClient()
    return await client.query_with_cascade(prompt, max_tokens, tools, system_prompt)


# Legacy convenience functions (kept for backward compatibility)
def synthesize_signals(entity_name: str, entity_type: str, signals: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """Convenience function to synthesize signals (legacy)"""
    client = ClaudeCodeClient()
    return client.synthesize_signals(entity_name, entity_type, signals)

def generate_cypher_query(query: str, entity_context: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """Convenience function to generate Cypher query (legacy)"""
    client = ClaudeCodeClient()
    return client.generate_cypher_query(query, entity_context, limit)


# =============================================================================
# Test / Main
# =============================================================================

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
