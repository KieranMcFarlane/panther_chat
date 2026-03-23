import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import os
import asyncio
import random
import time
import urllib.parse
from datetime import datetime
from dataclasses import dataclass
from collections import deque
from pathlib import Path
import httpx

try:
    from http_client_pool import HttpClientPool
except ImportError:
    from backend.http_client_pool import HttpClientPool

try:
    from anthropic import Anthropic
    ANTHROPIC_SDK_AVAILABLE = True
except ImportError:
    ANTHROPIC_SDK_AVAILABLE = False
    logging.warning("anthropic package not installed - some features may not work")

logger = logging.getLogger(__name__)


class LLMRequestError(RuntimeError):
    """Structured LLM request failure with retryability metadata."""

    def __init__(
        self,
        message: str,
        *,
        retryable: bool,
        provider: str,
        requested_model: Optional[str] = None,
        runtime_model: Optional[str] = None,
        status_code: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.provider = provider
        self.requested_model = requested_model
        self.runtime_model = runtime_model
        self.status_code = status_code


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

    _api_disabled_reason: Optional[str] = None
    _api_disabled_at_monotonic: Optional[float] = None
    _api_disabled_until_monotonic: Optional[float] = None
    _api_disabled_kind: Optional[str] = None
    _quota_circuit_trip_count: int = 0

    PROVIDER_ANTHROPIC = "anthropic"
    PROVIDER_CHUTES_OPENAI = "chutes_openai"
    PROVIDER_CHUTES_ANTHROPIC = "chutes_anthropic"

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        Initialize Claude client

        Args:
            api_key: Anthropic API key (default: from ANTHROPIC_API_KEY env)
            base_url: Custom base URL (default: from ANTHROPIC_BASE_URL env)
        """
        should_load_env = not any(
            os.getenv(key)
            for key in (
                "CHUTES_API_KEY",
                "LLM_PROVIDER",
                "CHUTES_MODEL_PRIMARY",
                "CHUTES_MODEL",
            )
        )
        if should_load_env:
            try:
                from dotenv import load_dotenv
                load_dotenv()
                parent_env = Path(__file__).parent.parent / ".env"
                if parent_env.exists():
                    load_dotenv(parent_env, override=False)
            except Exception:
                pass

        self.provider = self._resolve_provider()
        self.api_key = api_key or self._resolve_api_key()
        self.base_url = base_url or self._resolve_base_url()
        def _resolve_chutes_role_model(*env_keys: str, default: str) -> str:
            for key in env_keys:
                value = os.getenv(key)
                if value and value.strip():
                    return value.strip()
            return default

        self.chutes_model_planner = _resolve_chutes_role_model(
            "CHUTES_MODEL_PLANNER",
            "CHUTES_MODEL_PRIMARY",
            "CHUTES_MODEL_HAIKU",
            "CHUTES_MODEL",
            default="zai-org/GLM-5-TEE",
        )
        self.chutes_model_judge = _resolve_chutes_role_model(
            "CHUTES_MODEL_JUDGE",
            "CHUTES_MODEL_SECONDARY",
            "CHUTES_MODEL_SONNET",
            default="moonshotai/Kimi-K2.5-TEE",
        )
        self.chutes_model_fallback = _resolve_chutes_role_model(
            "CHUTES_MODEL_FALLBACK",
            "CHUTES_MODEL_TERTIARY",
            "CHUTES_MODEL_OPUS",
            default="MiniMaxAI/MiniMax-M2.5-TEE",
        )
        self.chutes_model_primary = self.chutes_model_planner
        self.chutes_model_secondary = self.chutes_model_judge
        self.chutes_model_tertiary = self.chutes_model_fallback
        self.chutes_model = self.chutes_model_planner
        self.chutes_model_haiku = self.chutes_model_planner
        self.chutes_model_sonnet = self.chutes_model_judge
        self.chutes_model_opus = self.chutes_model_fallback
        self.chutes_model_json_default = _resolve_chutes_role_model(
            "CHUTES_MODEL_JSON_DEFAULT",
            "CHUTES_MODEL_JUDGE",
            default="deepseek-ai/DeepSeek-V3.2-TEE",
        )
        self.chutes_model_json = _resolve_chutes_role_model(
            "CHUTES_MODEL_JSON",
            default=self.chutes_model_json_default,
        )
        self.chutes_json_force_model = self._parse_bool_env(
            os.getenv("CHUTES_JSON_FORCE_MODEL"),
            default=False,
        )
        self.chutes_model_json_fallback = os.getenv(
            "CHUTES_MODEL_JSON_FALLBACK",
            self.chutes_model_judge,
        ).strip() or self.chutes_model_judge
        self.chutes_json_min_max_tokens = max(64, int(os.getenv("CHUTES_JSON_MIN_MAX_TOKENS", "192")))
        self.chutes_json_length_retry_max_tokens = max(
            self.chutes_json_min_max_tokens,
            int(os.getenv("CHUTES_JSON_LENGTH_RETRY_MAX_TOKENS", "320")),
        )
        self.chutes_json_length_retry_enabled = self._parse_bool_env(
            os.getenv("CHUTES_JSON_LENGTH_RETRY_ENABLED"),
            default=False,
        )
        self.chutes_json_empty_retry_enabled = self._parse_bool_env(
            os.getenv("CHUTES_JSON_EMPTY_RETRY_ENABLED"),
            default=False,
        )
        self.chutes_json_response_format_enabled = self._parse_bool_env(
            os.getenv("CHUTES_JSON_RESPONSE_FORMAT_ENABLED"),
            default=True,
        )
        self.chutes_json_include_reasoning = self._parse_bool_env(
            os.getenv("CHUTES_JSON_INCLUDE_REASONING"),
            default=False,
        )
        self.chutes_fallback_model = os.getenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
        self.chutes_timeout_seconds = float(os.getenv("CHUTES_TIMEOUT_SECONDS", "45"))
        self.chutes_fallback_timeout_seconds = float(os.getenv("CHUTES_FALLBACK_TIMEOUT_SECONDS", "90"))
        self.chutes_stream_idle_timeout_seconds = float(
            os.getenv("CHUTES_STREAM_IDLE_TIMEOUT_SECONDS", str(self.chutes_timeout_seconds))
        )
        self.chutes_stream_enabled = self._parse_bool_env(os.getenv("CHUTES_STREAM_ENABLED"), default=True)
        self.chutes_max_retries = max(0, int(os.getenv("CHUTES_MAX_RETRIES", "7")))
        self.chutes_retries_before_fallback = max(1, int(os.getenv("CHUTES_RETRIES_BEFORE_FALLBACK", "5")))
        self.chutes_empty_retries_before_fallback = max(
            1,
            int(os.getenv("CHUTES_EMPTY_RETRIES_BEFORE_FALLBACK", str(self.chutes_retries_before_fallback))),
        )
        self.chutes_min_request_interval_seconds = float(os.getenv("CHUTES_MIN_REQUEST_INTERVAL_SECONDS", "0.0"))
        self.chutes_retry_backoff_cap_seconds = float(os.getenv("CHUTES_RETRY_BACKOFF_CAP_SECONDS", "30.0"))
        self.chutes_retry_jitter_seconds = float(os.getenv("CHUTES_RETRY_JITTER_SECONDS", "0.6"))
        self.chutes_429_policy = os.getenv("CHUTES_429_POLICY", "header_exponential").strip().lower() or "header_exponential"
        self.chutes_max_concurrent_requests = max(1, int(os.getenv("CHUTES_MAX_CONCURRENT_REQUESTS", "2")))
        self.chutes_circuit_ttl_seconds = float(os.getenv("CHUTES_CIRCUIT_TTL_SECONDS", "120"))
        self.chutes_circuit_ttl_multiplier = float(os.getenv("CHUTES_CIRCUIT_TTL_MULTIPLIER", "1.8"))
        self.chutes_circuit_ttl_max_seconds = float(os.getenv("CHUTES_CIRCUIT_TTL_MAX_SECONDS", "900"))
        self.chutes_circuit_canary_timeout_seconds = float(os.getenv("CHUTES_CIRCUIT_CANARY_TIMEOUT_SECONDS", "12"))
        self.chutes_circuit_canary_prompt = os.getenv("CHUTES_CIRCUIT_CANARY_PROMPT", "reply with ok")
        self.chutes_circuit_canary_max_tokens = int(os.getenv("CHUTES_CIRCUIT_CANARY_MAX_TOKENS", "8"))
        self.chutes_adaptive_pacing_enabled = self._parse_bool_env(
            os.getenv("CHUTES_ADAPTIVE_PACING_ENABLED"),
            default=True,
        )
        self.chutes_adaptive_window_seconds = float(os.getenv("CHUTES_ADAPTIVE_WINDOW_SECONDS", "90"))
        self.chutes_adaptive_rate_limit_multiplier = float(os.getenv("CHUTES_ADAPTIVE_RATE_LIMIT_MULTIPLIER", "1.6"))
        self.chutes_adaptive_error_multiplier = float(os.getenv("CHUTES_ADAPTIVE_ERROR_MULTIPLIER", "1.25"))
        self.chutes_adaptive_interval_max_seconds = float(os.getenv("CHUTES_ADAPTIVE_INTERVAL_MAX_SECONDS", "4.0"))
        self.chutes_adaptive_recovery_factor = float(os.getenv("CHUTES_ADAPTIVE_RECOVERY_FACTOR", "0.9"))
        self.chutes_rate_limit_cooldown_enabled = self._parse_bool_env(
            os.getenv("CHUTES_RATE_LIMIT_COOLDOWN_ENABLED"),
            default=True,
        )
        self.chutes_rate_limit_cooldown_base_seconds = float(
            os.getenv("CHUTES_RATE_LIMIT_COOLDOWN_BASE_SECONDS", "6.0")
        )
        self.chutes_rate_limit_cooldown_cap_seconds = float(
            os.getenv("CHUTES_RATE_LIMIT_COOLDOWN_CAP_SECONDS", "180.0")
        )
        self.chutes_rate_limit_cooldown_multiplier = float(
            os.getenv("CHUTES_RATE_LIMIT_COOLDOWN_MULTIPLIER", "1.8")
        )
        self.chutes_rate_limit_recovery_factor = float(
            os.getenv("CHUTES_RATE_LIMIT_RECOVERY_FACTOR", "0.7")
        )
        self.llm_provider_validation_strict = self._parse_bool_env(
            os.getenv("LLM_PROVIDER_VALIDATION_STRICT"),
            default=True,
        )

        disable_flag = (os.getenv("DISABLE_CLAUDE_API") or "").strip().lower()
        if disable_flag in {"1", "true", "yes", "on"}:
            self._disable_api_with_kind("disabled by environment", kind="env")

        if not self.api_key:
            logger.warning("⚠️ No LLM API key configured for selected provider - client will fail")
        self._validate_provider_configuration()

        self.default_model = "haiku"
        self.cascade_order = ["haiku", "sonnet", "opus"]
        self._chutes_rate_lock = asyncio.Lock()
        self._chutes_circuit_probe_lock = asyncio.Lock()
        self._chutes_last_request_monotonic = 0.0
        self._chutes_effective_min_interval_seconds = self.chutes_min_request_interval_seconds
        self._chutes_event_history = deque(maxlen=512)
        self._chutes_event_counter = 0
        self._chutes_request_semaphore = asyncio.Semaphore(self.chutes_max_concurrent_requests)
        self._chutes_rate_limit_cooldown_seconds = 0.0
        self._chutes_rate_limit_cooldown_until_monotonic = 0.0
        self._chutes_rate_limit_cooldown_until_epoch = 0.0
        self._http_client_pool = HttpClientPool()
        self._last_request_diagnostics: Dict[str, Any] = {
            "llm_provider": self.provider,
            "llm_retry_attempts": 0,
            "llm_last_status": "init",
            "llm_circuit_broken": bool(self._get_disabled_reason()),
            "llm_disable_reason": self._get_disabled_reason(),
            "llm_circuit_seconds_remaining": None,
            "llm_circuit_kind": getattr(self.__class__, "_api_disabled_kind", None),
        }

        logger.info(f"🤖 ClaudeClient initialized (provider: {self.provider}, default: {self.default_model})")

    @staticmethod
    def _parse_bool_env(value: Optional[str], *, default: bool) -> bool:
        if value is None:
            return default
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return default

    def _resolve_provider(self) -> str:
        provider = (os.getenv("LLM_PROVIDER") or "").strip().lower()
        if provider in {self.PROVIDER_ANTHROPIC, self.PROVIDER_CHUTES_OPENAI, self.PROVIDER_CHUTES_ANTHROPIC}:
            return provider

        if os.getenv("CHUTES_API_KEY"):
            return self.PROVIDER_CHUTES_OPENAI

        return self.PROVIDER_ANTHROPIC

    def _resolve_api_key(self) -> Optional[str]:
        if self.provider in {self.PROVIDER_CHUTES_OPENAI, self.PROVIDER_CHUTES_ANTHROPIC}:
            return os.getenv("CHUTES_API_KEY")

        return os.getenv("ANTHROPIC_API_KEY")

    def _resolve_base_url(self) -> str:
        if self.provider == self.PROVIDER_CHUTES_OPENAI:
            return os.getenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")

        if self.provider == self.PROVIDER_CHUTES_ANTHROPIC:
            return (
                os.getenv("CHUTES_ANTHROPIC_BASE_URL")
                or os.getenv("CHUTES_BASE_URL")
                or "https://llm.chutes.ai/v1"
            )

        return os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

    def _validate_provider_configuration(self) -> None:
        """Fail fast on known-invalid Chutes provider/model/endpoint combinations."""
        if not self.llm_provider_validation_strict:
            return
        if self.provider not in {self.PROVIDER_CHUTES_OPENAI, self.PROVIDER_CHUTES_ANTHROPIC}:
            return

        parsed = urllib.parse.urlparse(self.base_url)
        path_lower = (parsed.path or "").lower().rstrip("/")
        model_lower = str(self.chutes_model or "").lower()
        model_family_ok = ("glm" in model_lower) or ("kimi" in model_lower) or ("minimax" in model_lower)
        if not model_family_ok:
            raise ValueError(
                f"Unsupported Chutes model for strict validation: {self.chutes_model}. "
                "Expected GLM/Kimi/MiniMax family."
            )
        if self.provider == self.PROVIDER_CHUTES_OPENAI and "anthropic" in path_lower:
            raise ValueError(
                f"Invalid base URL for {self.PROVIDER_CHUTES_OPENAI}: {self.base_url}. "
                "Use OpenAI-compatible /v1 endpoint."
            )
        if self.provider == self.PROVIDER_CHUTES_ANTHROPIC and path_lower.endswith("/v1") and "anthropic" not in path_lower:
            raise ValueError(
                f"Invalid base URL for {self.PROVIDER_CHUTES_ANTHROPIC}: {self.base_url}. "
                "Use Anthropic-compatible endpoint base."
            )

    def _resolve_chutes_runtime_model(self, requested_model: Optional[str]) -> str:
        normalized = str(requested_model or "haiku").strip().lower()
        if normalized in {"planner", "primary", "haiku"}:
            return self.chutes_model_planner
        if normalized in {"judge", "secondary", "sonnet"}:
            return self.chutes_model_judge
        if normalized in {"fallback", "tertiary", "opus"}:
            return self.chutes_model_fallback
        return self.chutes_model

    @classmethod
    def _get_disabled_reason(cls) -> Optional[str]:
        return cls._api_disabled_reason

    @classmethod
    def _disable_api(cls, reason: str):
        if not cls._api_disabled_reason:
            cls._api_disabled_reason = reason
            cls._api_disabled_at_monotonic = time.monotonic()
            cls._api_disabled_kind = "runtime"
            cls._api_disabled_until_monotonic = None
            logger.warning(f"⚠️ Disabling Claude API for current process: {reason}")

    @classmethod
    def _disable_api_with_kind(
        cls,
        reason: str,
        *,
        kind: str = "runtime",
        cooldown_seconds: Optional[float] = None,
    ) -> None:
        now = time.monotonic()
        if not cls._api_disabled_reason:
            cls._api_disabled_reason = reason
            cls._api_disabled_at_monotonic = now
            cls._api_disabled_kind = kind
            cls._api_disabled_until_monotonic = (
                now + cooldown_seconds if kind == "quota" and cooldown_seconds and cooldown_seconds > 0 else None
            )
            logger.warning(f"⚠️ Disabling Claude API for current process: {reason}")
            return
        if kind == "quota":
            cls._api_disabled_reason = reason
            cls._api_disabled_kind = kind
            cls._api_disabled_at_monotonic = now
            cls._api_disabled_until_monotonic = (
                now + cooldown_seconds if cooldown_seconds and cooldown_seconds > 0 else None
            )

    @classmethod
    def _clear_disabled_reason(cls) -> None:
        cls._api_disabled_reason = None
        cls._api_disabled_at_monotonic = None
        cls._api_disabled_kind = None
        cls._api_disabled_until_monotonic = None

    @classmethod
    def _reset_quota_circuit(cls) -> None:
        cls._quota_circuit_trip_count = 0
        if cls._api_disabled_kind == "quota":
            cls._clear_disabled_reason()

    def _compute_quota_cooldown_seconds(self) -> float:
        base = max(float(self.chutes_circuit_ttl_seconds or 0.0), 0.0)
        if base <= 0.0:
            return 0.0
        multiplier = max(float(self.chutes_circuit_ttl_multiplier or 1.0), 1.0)
        trips = max(int(getattr(self.__class__, "_quota_circuit_trip_count", 0)), 0)
        cooldown = base * (multiplier ** max(trips - 1, 0))
        max_cooldown = max(float(self.chutes_circuit_ttl_max_seconds or 0.0), base)
        return min(cooldown, max_cooldown)

    def _get_effective_disabled_reason(self) -> Optional[str]:
        reason = self._get_disabled_reason()
        if not reason:
            return None
        kind = getattr(self.__class__, "_api_disabled_kind", None)
        if kind == "env":
            return reason
        if self.provider not in {self.PROVIDER_CHUTES_OPENAI, self.PROVIDER_CHUTES_ANTHROPIC}:
            return reason
        if kind == "quota" and getattr(self.__class__, "_api_disabled_until_monotonic", None) is not None:
            return reason
        ttl = float(getattr(self, "chutes_circuit_ttl_seconds", 0.0) or 0.0)
        if ttl <= 0:
            return reason
        disabled_at = getattr(self.__class__, "_api_disabled_at_monotonic", None)
        if disabled_at is None:
            return reason
        if (time.monotonic() - disabled_at) >= ttl:
            self._clear_disabled_reason()
            return None
        return reason

    def _current_circuit_remaining_seconds(self) -> Optional[float]:
        if self._get_disabled_reason() is None:
            return None
        disabled_until = getattr(self.__class__, "_api_disabled_until_monotonic", None)
        if disabled_until is not None:
            return max(0.0, disabled_until - time.monotonic())
        disabled_at = getattr(self.__class__, "_api_disabled_at_monotonic", None)
        if disabled_at is None:
            return None
        ttl = float(getattr(self, "chutes_circuit_ttl_seconds", 0.0) or 0.0)
        return max(0.0, ttl - (time.monotonic() - disabled_at)) if ttl > 0 else None

    def _quota_probe_due(self) -> bool:
        if getattr(self.__class__, "_api_disabled_kind", None) != "quota":
            return False
        disabled_until = getattr(self.__class__, "_api_disabled_until_monotonic", None)
        return bool(disabled_until is not None and time.monotonic() >= disabled_until)

    async def _attempt_quota_canary_probe_openai(self, headers: Dict[str, str]) -> bool:
        async with self._chutes_circuit_probe_lock:
            if not self._quota_probe_due():
                return self._get_disabled_reason() is None
            try:
                timeout_seconds = max(self.chutes_circuit_canary_timeout_seconds, 1.0)
                timeout = httpx.Timeout(timeout=timeout_seconds, connect=min(timeout_seconds, 8.0))
                payload = {
                    "model": self.chutes_model,
                    "messages": [{"role": "user", "content": self.chutes_circuit_canary_prompt}],
                    "max_tokens": max(1, int(self.chutes_circuit_canary_max_tokens)),
                    "temperature": 0,
                    "stream": False,
                }
                async with self._chutes_request_semaphore:
                    await self._apply_chutes_request_throttle()
                    probe = await self._query_chutes_non_stream(payload=payload, headers=headers, timeout=timeout)
                content = str(probe.get("answer_text") or probe.get("reasoning_text") or "").strip()
                if not content:
                    raise RuntimeError("quota canary returned empty response")
                self._clear_disabled_reason()
                self._reset_quota_circuit()
                logger.info("♻️ Re-enabled Chutes after successful quota canary probe")
                return True
            except Exception as exc:
                self.__class__._quota_circuit_trip_count += 1
                cooldown = self._compute_quota_cooldown_seconds()
                self._disable_api_with_kind("insufficient balance", kind="quota", cooldown_seconds=cooldown)
                logger.warning(
                    "Quota canary probe failed; keeping circuit open for %.1fs: %s",
                    cooldown,
                    self._format_chutes_error(exc),
                )
                return False

    @staticmethod
    def _is_insufficient_balance_error(error: Exception) -> bool:
        message = str(error).lower()
        return "429" in message and (
            "insufficient balance" in message or
            "no resource package" in message or
            "please recharge" in message
        )

    @staticmethod
    def _is_retryable_chutes_error(error: Exception) -> bool:
        if isinstance(error, (httpx.TimeoutException, httpx.TransportError)):
            return True
        if isinstance(error, httpx.HTTPStatusError):
            status_code = error.response.status_code if error.response is not None else None
            return status_code in {408, 425, 429} or (status_code is not None and status_code >= 500)
        return False

    def _should_switch_to_fallback(self, *, attempt: int, threshold: int, current_model: str) -> bool:
        if not self.chutes_fallback_model:
            return False
        if current_model == self.chutes_fallback_model:
            return False
        return (attempt + 1) >= max(1, int(threshold))

    @staticmethod
    def _extract_http_error_text(error: Exception) -> str:
        if not isinstance(error, httpx.HTTPStatusError) or error.response is None:
            return ""
        try:
            return (error.response.text or "").strip()
        except Exception:
            return ""

    def _classify_chutes_429(self, error: Exception) -> str:
        body_lower = self._extract_http_error_text(error).lower()
        if (
            "insufficient balance" in body_lower
            or "no resource package" in body_lower
            or "please recharge" in body_lower
            or '"code":"1113"' in body_lower
            or "'code': '1113'" in body_lower
        ):
            return "insufficient_balance"
        return "rate_limit"

    def _compute_chutes_backoff_seconds(
        self,
        *,
        attempt: int,
        retry_after_seconds: Optional[float],
        is_http_429: bool = False,
    ) -> float:
        if retry_after_seconds is not None and retry_after_seconds > 0:
            return retry_after_seconds
        cap = max(self.chutes_retry_backoff_cap_seconds, 0.0)
        if is_http_429 and self.chutes_429_policy == "header_exponential":
            profile = [3.0, 7.0, 15.0]
            base = min(profile[min(max(attempt, 0), len(profile) - 1)], cap)
            return max(0.0, base + random.uniform(0.0, max(self.chutes_retry_jitter_seconds, 0.0)))
        base = min(2 ** max(attempt, 0), cap)
        return max(0.0, base + random.uniform(0.0, max(self.chutes_retry_jitter_seconds, 0.0)))

    def _effective_chutes_min_interval_seconds(self) -> float:
        if not self.chutes_adaptive_pacing_enabled:
            return max(0.0, float(self.chutes_min_request_interval_seconds or 0.0))
        return max(0.0, float(self._chutes_effective_min_interval_seconds or 0.0))

    def _prune_chutes_event_history(self, now: Optional[float] = None) -> None:
        if not self.chutes_adaptive_pacing_enabled:
            return
        now = now if now is not None else time.monotonic()
        cutoff = now - float(self.chutes_adaptive_window_seconds)
        while self._chutes_event_history and self._chutes_event_history[0]["time"] < cutoff:
            self._chutes_event_history.popleft()

    def _record_chutes_event(
        self,
        status: str,
        *,
        wait_seconds: float = 0.0,
        status_code: Optional[int] = None,
    ) -> None:
        if not self.chutes_adaptive_pacing_enabled:
            return
        now = time.monotonic()
        self._chutes_event_history.append(
            {
                "time": now,
                "status": str(status or "unknown"),
                "wait_seconds": max(0.0, float(wait_seconds or 0.0)),
                "status_code": status_code,
            }
        )
        self._chutes_event_counter += 1
        self._prune_chutes_event_history(now=now)

    def _get_chutes_pacing_snapshot(self) -> Dict[str, Any]:
        if self.chutes_adaptive_pacing_enabled:
            self._prune_chutes_event_history()
            events = list(self._chutes_event_history)
        else:
            events = []
        window_seconds = float(self.chutes_adaptive_window_seconds)
        event_count = len(events)
        rpm = (event_count / window_seconds) * 60.0 if window_seconds > 0 else 0.0
        rate_limits = sum(1 for event in events if event.get("status") == "rate_limit")
        retryable_errors = sum(1 for event in events if event.get("status") == "retryable_error")
        success = sum(1 for event in events if event.get("status") == "success")
        return {
            "chutes_effective_min_interval_seconds": round(self._effective_chutes_min_interval_seconds(), 4),
            "chutes_window_requests_per_minute": round(rpm, 4),
            "chutes_window_rate_limit_events": int(rate_limits),
            "chutes_window_error_events": int(retryable_errors),
            "chutes_window_success_ratio": round((success / event_count) if event_count else 0.0, 4),
            "chutes_rate_limit_cooldown_seconds": round(
                max(0.0, float(self._chutes_rate_limit_cooldown_seconds or 0.0)),
                3,
            ),
            "chutes_rate_limit_cooldown_remaining_seconds": round(
                max(0.0, float(self._chutes_rate_limit_cooldown_until_monotonic or 0.0) - time.monotonic()),
                3,
            ),
        }

    def _set_chutes_rate_limit_cooldown(
        self,
        *,
        attempt: int,
        retry_after_seconds: Optional[float] = None,
    ) -> float:
        if not self.chutes_rate_limit_cooldown_enabled:
            return 0.0
        cap = max(0.0, float(self.chutes_rate_limit_cooldown_cap_seconds or 0.0))
        base = max(0.0, float(self.chutes_rate_limit_cooldown_base_seconds or 0.0))
        current = max(0.0, float(self._chutes_rate_limit_cooldown_seconds or 0.0))
        exponential = base * (2 ** max(0, int(attempt)))
        grown = max(exponential, current * max(1.0, float(self.chutes_rate_limit_cooldown_multiplier or 1.0)))
        candidate = max(base, grown)
        if retry_after_seconds is not None and retry_after_seconds > 0:
            candidate = max(candidate, float(retry_after_seconds))
        if cap > 0:
            candidate = min(candidate, cap)
        self._chutes_rate_limit_cooldown_seconds = max(0.0, candidate)
        self._chutes_rate_limit_cooldown_until_monotonic = time.monotonic() + self._chutes_rate_limit_cooldown_seconds
        self._chutes_rate_limit_cooldown_until_epoch = time.time() + self._chutes_rate_limit_cooldown_seconds
        return self._chutes_rate_limit_cooldown_seconds

    def _recover_chutes_rate_limit_cooldown(self) -> None:
        if not self.chutes_rate_limit_cooldown_enabled:
            return
        current = max(0.0, float(self._chutes_rate_limit_cooldown_seconds or 0.0))
        if current <= 0.0:
            self._chutes_rate_limit_cooldown_seconds = 0.0
            self._chutes_rate_limit_cooldown_until_monotonic = 0.0
            return
        factor = min(1.0, max(0.0, float(self.chutes_rate_limit_recovery_factor or 0.7)))
        next_value = current * factor
        floor = max(0.0, float(self.chutes_rate_limit_cooldown_base_seconds or 0.0))
        if next_value <= floor * 0.5:
            self._chutes_rate_limit_cooldown_seconds = 0.0
            self._chutes_rate_limit_cooldown_until_monotonic = 0.0
            self._chutes_rate_limit_cooldown_until_epoch = 0.0
            return
        self._chutes_rate_limit_cooldown_seconds = max(floor, next_value)
        self._chutes_rate_limit_cooldown_until_monotonic = 0.0
        self._chutes_rate_limit_cooldown_until_epoch = 0.0

    async def _wait_for_chutes_rate_limit_cooldown(self) -> None:
        if not self.chutes_rate_limit_cooldown_enabled:
            return
        remaining = max(0.0, float(self._chutes_rate_limit_cooldown_until_monotonic or 0.0) - time.monotonic())
        if remaining <= 0.0:
            return
        logger.warning("⏳ Chutes in cooldown after rate-limit; waiting %.2fs before next request", remaining)
        await asyncio.sleep(remaining)
        self._chutes_rate_limit_cooldown_until_monotonic = 0.0
        self._chutes_rate_limit_cooldown_until_epoch = 0.0

    def _set_chutes_effective_min_interval(self, interval_seconds: float) -> None:
        base = max(0.0, float(self.chutes_min_request_interval_seconds or 0.0))
        if not self.chutes_adaptive_pacing_enabled:
            self._chutes_effective_min_interval_seconds = base
            return
        ceiling = max(base, float(self.chutes_adaptive_interval_max_seconds or 0.0))
        self._chutes_effective_min_interval_seconds = min(max(float(interval_seconds or 0.0), base), ceiling)

    def _apply_chutes_adaptive_penalty(self, *, is_rate_limit: bool) -> None:
        if not self.chutes_adaptive_pacing_enabled:
            return
        base = max(0.0, float(self.chutes_min_request_interval_seconds or 0.0))
        current = max(float(self._chutes_effective_min_interval_seconds or 0.0), max(base, 0.05))
        multiplier = self.chutes_adaptive_rate_limit_multiplier if is_rate_limit else self.chutes_adaptive_error_multiplier
        self._set_chutes_effective_min_interval(current * max(float(multiplier), 1.0))

    def _apply_chutes_adaptive_recovery(self) -> None:
        if not self.chutes_adaptive_pacing_enabled:
            return
        base = max(0.0, float(self.chutes_min_request_interval_seconds or 0.0))
        current = max(float(self._chutes_effective_min_interval_seconds or 0.0), base)
        if current <= base:
            return
        factor = min(1.0, max(0.0, float(self.chutes_adaptive_recovery_factor or 0.9)))
        self._set_chutes_effective_min_interval(current * factor)

    async def _apply_chutes_request_throttle(self) -> None:
        min_interval_seconds = self._effective_chutes_min_interval_seconds()
        if min_interval_seconds <= 0.0:
            return
        async with self._chutes_rate_lock:
            now = time.monotonic()
            elapsed = now - self._chutes_last_request_monotonic
            wait_seconds = min_interval_seconds - elapsed
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
                self._record_chutes_event("throttle_wait", wait_seconds=wait_seconds)
            self._chutes_last_request_monotonic = time.monotonic()

    def _set_last_request_diagnostics(
        self,
        *,
        retry_attempts: int,
        last_status: str,
        circuit_broken: bool = False,
        disable_reason: Optional[str] = None,
    ) -> None:
        self._last_request_diagnostics = {
            "llm_provider": self.provider,
            "llm_retry_attempts": max(0, int(retry_attempts)),
            "llm_last_status": last_status,
            "llm_circuit_broken": bool(circuit_broken),
            "llm_disable_reason": disable_reason,
            "llm_circuit_seconds_remaining": self._current_circuit_remaining_seconds(),
            "llm_circuit_kind": getattr(self.__class__, "_api_disabled_kind", None),
            **self._get_chutes_pacing_snapshot(),
        }
        if last_status == "ok":
            self._reset_quota_circuit()

    def get_runtime_diagnostics(self) -> Dict[str, Any]:
        return dict(self._last_request_diagnostics)

    async def close(self) -> None:
        await self._http_client_pool.close()

    @staticmethod
    def _format_chutes_error(error: Exception) -> str:
        if isinstance(error, httpx.HTTPStatusError):
            status_code = error.response.status_code if error.response is not None else "unknown"
            body_preview = ""
            if error.response is not None:
                try:
                    body_preview = (error.response.text or "").strip()
                except Exception:  # noqa: BLE001
                    body_preview = ""
            if body_preview:
                body_preview = body_preview[:300]
                return f"http_status={status_code} body={body_preview}"
            return f"http_status={status_code}"

        if isinstance(error, httpx.TimeoutException):
            return f"{error.__class__.__name__}: timed out after request timeout"

        if isinstance(error, httpx.RequestError):
            request_url = getattr(getattr(error, "request", None), "url", None)
            return f"{error.__class__.__name__}: request_url={request_url or 'unknown'} detail={str(error) or 'request failed'}"

        return f"{error.__class__.__name__}: {str(error) or 'unknown error'}"

    @staticmethod
    def _extract_text_parts(value: Any) -> str:
        """Normalize OpenAI-compatible content deltas into plain text."""
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return str(value.get("text", "") or "")
        if isinstance(value, list):
            parts: List[str] = []
            for item in value:
                text = ClaudeClient._extract_text_parts(item)
                if text:
                    parts.append(text)
            return "".join(parts)
        return ""

    @staticmethod
    def _extract_structured_output(value: Any) -> Optional[Dict[str, Any]]:
        """Extract strict JSON payloads from model content when available."""
        if isinstance(value, dict):
            return dict(value)

        candidates: List[str] = []
        if isinstance(value, str):
            candidates.append(value.strip())
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    parsed_item = item.get("parsed")
                    if isinstance(parsed_item, dict):
                        return dict(parsed_item)
                    text_value = item.get("text")
                    if isinstance(text_value, str):
                        candidates.append(text_value.strip())
                    content_value = item.get("content")
                    if isinstance(content_value, str):
                        candidates.append(content_value.strip())
                elif isinstance(item, str):
                    candidates.append(item.strip())

        for candidate in candidates:
            if not candidate:
                continue
            trimmed = candidate.strip()
            if not trimmed.startswith("{"):
                if "```" in trimmed:
                    trimmed = trimmed.replace("```json", "```").replace("```JSON", "```")
                    parts = [part.strip() for part in trimmed.split("```") if part.strip()]
                    object_part = next((part for part in parts if part.startswith("{") and part.endswith("}")), "")
                    if object_part:
                        trimmed = object_part
                if not trimmed.startswith("{"):
                    start = trimmed.find("{")
                    end = trimmed.rfind("}")
                    if start >= 0 and end > start:
                        trimmed = trimmed[start : end + 1]
            if not trimmed.startswith("{"):
                continue
            try:
                parsed = json.loads(trimmed)
            except Exception:  # noqa: BLE001
                continue
            if isinstance(parsed, dict):
                return parsed
        return None
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
        if self.provider in {self.PROVIDER_CHUTES_OPENAI, self.PROVIDER_CHUTES_ANTHROPIC}:
            # Chutes runs a single configured model; avoid logical cascade retries.
            result = await self._query(
                prompt=prompt,
                model=self.default_model,
                max_tokens=max_tokens,
                tools=tools,
                system_prompt=system_prompt,
            )
            result["cascade_attempts"] = 1
            return result

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
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        json_schema: Optional[Dict[str, Any]] = None,
        stream: Optional[bool] = None,
        max_retries_override: Optional[int] = None,
        empty_retries_before_fallback_override: Optional[int] = None,
        fast_fail_on_length: bool = False,
    ) -> Dict[str, Any]:
        """
        Query Claude with specific model using Anthropic SDK

        Args:
            prompt: User prompt
            model: Model name (haiku, sonnet, opus)
            max_tokens: Maximum tokens to generate
            tools: Optional list of tools
            system_prompt: Optional system prompt

        Returns:
            Response dict with content, tokens_used, etc.
        """
        if self.provider == self.PROVIDER_CHUTES_OPENAI:
            return await self._query_chutes(
                prompt=prompt,
                model=model,
                max_tokens=max_tokens,
                system_prompt=system_prompt,
                json_mode=json_mode,
                json_schema=json_schema,
                stream=stream,
                max_retries_override=max_retries_override,
                empty_retries_before_fallback_override=empty_retries_before_fallback_override,
                fast_fail_on_length=fast_fail_on_length,
            )
        if self.provider == self.PROVIDER_CHUTES_ANTHROPIC:
            return await self._query_chutes_anthropic(
                prompt=prompt,
                model=model,
                max_tokens=max_tokens,
                system_prompt=system_prompt,
                json_mode=json_mode,
                json_schema=json_schema,
                stream=stream,
                max_retries_override=max_retries_override,
                empty_retries_before_fallback_override=empty_retries_before_fallback_override,
                fast_fail_on_length=fast_fail_on_length,
            )

        if not ANTHROPIC_SDK_AVAILABLE:
            raise ImportError("anthropic package is required. Install with: pip install anthropic")

        disabled_reason = self._get_effective_disabled_reason()
        if disabled_reason:
            raise RuntimeError(f"Claude API disabled: {disabled_reason}")

        model_config = ModelRegistry.get_model(model)

        if not model_config:
            raise ValueError(f"Unknown model: {model}")

        try:
            # Use Anthropic SDK (same as template_discovery.py and ralph_loop_server.py)
            client = Anthropic(
                base_url=self.base_url,
                api_key=self.api_key
            )

            # Build messages
            messages = [{"role": "user", "content": prompt}]

            # Create message
            response = client.messages.create(
                model=model_config.model_id,
                max_tokens=max_tokens,
                messages=messages,
                temperature=0.7 if system_prompt is None else 0.4,
                system=system_prompt
            )

            # Extract content
            content = response.content[0].text if response.content else ""

            return {
                "content": content,
                "model_used": model,
                "raw_response": response.model_dump(),
                "tokens_used": response.usage.model_dump() if hasattr(response, 'usage') else {},
                "stop_reason": response.stop_reason
            }

        except Exception as e:
            logger.error(f"Claude API request failed: {e}")
            if self._is_insufficient_balance_error(e):
                self._disable_api("insufficient balance")
            raise

    async def _query_chutes(
        self,
        prompt: str,
        model: str,
        max_tokens: int,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        json_schema: Optional[Dict[str, Any]] = None,
        stream: Optional[bool] = None,
        max_retries_override: Optional[int] = None,
        empty_retries_before_fallback_override: Optional[int] = None,
        fast_fail_on_length: bool = False,
    ) -> Dict[str, Any]:
        """
        Query a Chutes OpenAI-compatible model endpoint.

        The pipeline still calls this through the Claude client interface, but the
        transport is OpenAI chat completions and the model is configured via CHUTES_MODEL.
        """
        disabled_reason = self._get_effective_disabled_reason()
        if disabled_reason:
            raise RuntimeError(f"Claude API disabled: {disabled_reason}")

        if not self.api_key:
            raise RuntimeError("CHUTES_API_KEY not configured")

        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        runtime_model = self._resolve_chutes_runtime_model(model)
        # Keep role-based routing for structured calls unless force-enabled.
        explicit_json_alias = str(model or "").strip().lower() in {"json", "structured", "json_model"}
        if json_mode and self.chutes_model_json and (self.chutes_json_force_model or explicit_json_alias):
            runtime_model = self.chutes_model_json
        request_stream = self.chutes_stream_enabled if stream is None else bool(stream)
        payload = {
            "model": runtime_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0 if json_mode else (0.7 if system_prompt is None else 0.4),
            "stream": request_stream,
        }
        if json_mode:
            payload["max_tokens"] = max(max_tokens, self.chutes_json_min_max_tokens)
            payload["include_reasoning"] = bool(self.chutes_json_include_reasoning)
            if self.chutes_json_response_format_enabled:
                if isinstance(json_schema, dict):
                    payload["response_format"] = {"type": "json_schema", "json_schema": json_schema}
                else:
                    payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if self._quota_probe_due():
            await self._attempt_quota_canary_probe_openai(headers)
            disabled_reason = self._get_effective_disabled_reason()
            if disabled_reason:
                self._set_last_request_diagnostics(
                    retry_attempts=0,
                    last_status="circuit_open",
                    circuit_broken=True,
                    disable_reason=disabled_reason,
                )
                raise RuntimeError(f"Claude API disabled: {disabled_reason}")

        last_error: Optional[Exception] = None

        max_retries = self.chutes_max_retries if max_retries_override is None else max(0, int(max_retries_override))
        empty_before_fallback = (
            self.chutes_empty_retries_before_fallback
            if empty_retries_before_fallback_override is None
            else max(1, int(empty_retries_before_fallback_override))
        )

        attempted_json_length_retry = False
        for attempt in range(max_retries + 1):
            try:
                await self._wait_for_chutes_rate_limit_cooldown()
                using_fallback_model = (
                    payload["model"] == self.chutes_fallback_model and payload["model"] != self.chutes_model
                )
                request_timeout_seconds = (
                    max(self.chutes_timeout_seconds, self.chutes_fallback_timeout_seconds)
                    if using_fallback_model
                    else self.chutes_timeout_seconds
                )
                timeout = httpx.Timeout(
                    timeout=request_timeout_seconds,
                    connect=min(request_timeout_seconds, 15.0),
                    read=min(request_timeout_seconds, self.chutes_stream_idle_timeout_seconds),
                )
                if request_stream:
                    async with self._chutes_request_semaphore:
                        await self._apply_chutes_request_throttle()
                        data = await self._query_chutes_streaming(
                            payload=payload,
                            headers=headers,
                            timeout=timeout,
                        )
                else:
                    async with self._chutes_request_semaphore:
                        await self._apply_chutes_request_throttle()
                        data = await self._query_chutes_non_stream(
                            payload=payload,
                            headers=headers,
                            timeout=timeout,
                        )

                content = data.get("answer_text", "")
                reasoning_content = data.get("reasoning_text", "")
                structured_output = data.get("structured_output")
                if not content and isinstance(structured_output, dict):
                    # Some providers return strict JSON only in parsed/structured channels.
                    content = json.dumps(structured_output, separators=(",", ":"))
                usage = data.get("usage", {})
                stop_reason = data.get("stop_reason")
                chunk_count = int(data.get("chunk_count", 0) or 0)
                strict_json_hard_fail = bool(json_mode and fast_fail_on_length)

                if str(stop_reason or "").strip().lower() == "length" and fast_fail_on_length:
                    if json_mode and self.chutes_json_length_retry_enabled and not attempted_json_length_retry:
                        retry_model = self.chutes_model_json_fallback
                        if retry_model and retry_model != payload["model"]:
                            attempted_json_length_retry = True
                            payload["model"] = retry_model
                            payload["max_tokens"] = max(
                                int(payload.get("max_tokens") or 0),
                                self.chutes_json_length_retry_max_tokens,
                            )
                            logger.warning(
                                "Chutes JSON length-stop on model=%s; retrying once with JSON fallback model=%s max_tokens=%s",
                                runtime_model,
                                retry_model,
                                payload["max_tokens"],
                            )
                            continue
                    self._record_chutes_event("success")
                    self._apply_chutes_adaptive_recovery()
                    self._set_last_request_diagnostics(retry_attempts=attempt, last_status="length_fast_fail")
                    return {
                        "content": "",
                        "reasoning_content": reasoning_content,
                        "model_used": payload["model"],
                        "requested_model": model,
                        "provider": self.provider,
                        "structured_output": structured_output,
                        "raw_response": data.get("raw_response"),
                        "tokens_used": {
                            "input_tokens": usage.get("prompt_tokens"),
                            "output_tokens": usage.get("completion_tokens"),
                            "total_tokens": usage.get("total_tokens"),
                        },
                        "stop_reason": stop_reason,
                        "inference_diagnostics": {
                            "streaming": bool(request_stream),
                            "streaming_override": request_stream != self.chutes_stream_enabled,
                            "fallback_used": bool(payload["model"] != self.chutes_model),
                            "chunk_count": chunk_count,
                            "answer_channel_chars": 0,
                            "reasoning_channel_chars": len(reasoning_content),
                            "length_fast_fail": True,
                        },
                    }

                if not content and strict_json_hard_fail and not self.chutes_json_empty_retry_enabled:
                    self._record_chutes_event("success")
                    self._apply_chutes_adaptive_recovery()
                    self._set_last_request_diagnostics(retry_attempts=attempt, last_status="empty_content_fast_fail")
                    return {
                        "content": "",
                        "reasoning_content": reasoning_content,
                        "model_used": payload["model"],
                        "requested_model": model,
                        "provider": self.provider,
                        "structured_output": structured_output,
                        "raw_response": data.get("raw_response"),
                        "tokens_used": {
                            "input_tokens": usage.get("prompt_tokens"),
                            "output_tokens": usage.get("completion_tokens"),
                            "total_tokens": usage.get("total_tokens"),
                        },
                        "stop_reason": stop_reason,
                        "inference_diagnostics": {
                            "streaming": bool(request_stream),
                            "streaming_override": request_stream != self.chutes_stream_enabled,
                            "fallback_used": bool(payload["model"] != self.chutes_model),
                            "chunk_count": chunk_count,
                            "answer_channel_chars": 0,
                            "reasoning_channel_chars": len(reasoning_content),
                            "empty_content_fast_fail": True,
                        },
                    }

                if not content and self.chutes_fallback_model and payload["model"] != self.chutes_fallback_model:
                    if self._should_switch_to_fallback(
                        attempt=attempt,
                        threshold=empty_before_fallback,
                        current_model=str(payload["model"]),
                    ):
                        logger.warning(
                            "Chutes empty response threshold reached for model=%s finish_reason=%s; switching to fallback model=%s",
                            payload["model"],
                            stop_reason,
                            self.chutes_fallback_model,
                        )
                        payload["model"] = self.chutes_fallback_model
                    else:
                        logger.warning(
                            "Chutes empty response for model=%s finish_reason=%s; retrying primary model (%s/%s before fallback)",
                            payload["model"],
                            stop_reason,
                            attempt + 1,
                            empty_before_fallback,
                        )
                        backoff_seconds = self._compute_chutes_backoff_seconds(
                            attempt=attempt,
                            retry_after_seconds=None,
                            is_http_429=False,
                        )
                        await asyncio.sleep(backoff_seconds)
                    continue
                self._record_chutes_event("success")
                self._apply_chutes_adaptive_recovery()
                self._recover_chutes_rate_limit_cooldown()
                self._set_last_request_diagnostics(retry_attempts=attempt, last_status="ok")

                return {
                    "content": content,
                    "reasoning_content": reasoning_content,
                    "model_used": payload["model"],
                    "requested_model": model,
                    "provider": self.provider,
                    "structured_output": structured_output,
                    "raw_response": data.get("raw_response"),
                    "tokens_used": {
                        "input_tokens": usage.get("prompt_tokens"),
                        "output_tokens": usage.get("completion_tokens"),
                        "total_tokens": usage.get("total_tokens"),
                    },
                    "stop_reason": stop_reason,
                    "inference_diagnostics": {
                        "streaming": bool(request_stream),
                        "streaming_override": request_stream != self.chutes_stream_enabled,
                        "fallback_used": bool(payload["model"] != self.chutes_model),
                        "chunk_count": chunk_count,
                        "answer_channel_chars": len(content),
                        "reasoning_channel_chars": len(reasoning_content),
                    },
                }
            except Exception as e:
                last_error = e
                error_detail = self._format_chutes_error(e)
                logger.error(
                    "Chutes API request failed (attempt %s/%s): %s",
                    attempt + 1,
                    max_retries + 1,
                    error_detail,
                )
                if self._is_insufficient_balance_error(e):
                    self.__class__._quota_circuit_trip_count += 1
                    cooldown = self._compute_quota_cooldown_seconds()
                    self._disable_api_with_kind("insufficient balance", kind="quota", cooldown_seconds=cooldown)
                    self._set_last_request_diagnostics(
                        retry_attempts=attempt,
                        last_status="insufficient_balance",
                        circuit_broken=True,
                        disable_reason=self._get_disabled_reason(),
                    )
                    raise LLMRequestError(
                        f"Chutes insufficient balance: {error_detail}",
                        retryable=False,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                is_retryable = self._is_retryable_chutes_error(e)
                status_code = e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None
                is_429 = status_code == 429
                if is_429:
                    classification = self._classify_chutes_429(e)
                    if classification == "insufficient_balance":
                        self.__class__._quota_circuit_trip_count += 1
                        cooldown = self._compute_quota_cooldown_seconds()
                        self._disable_api_with_kind("insufficient balance", kind="quota", cooldown_seconds=cooldown)
                        self._set_last_request_diagnostics(
                            retry_attempts=attempt,
                            last_status="quota_circuit_open",
                            circuit_broken=True,
                            disable_reason=self._get_disabled_reason(),
                        )
                    self._record_chutes_event("rate_limit", status_code=status_code)
                    self._apply_chutes_adaptive_penalty(is_rate_limit=True)
                    try:
                        retry_after_header = e.response.headers.get("Retry-After") if e.response is not None else None
                        retry_after_seconds = float(retry_after_header) if retry_after_header else None
                    except (TypeError, ValueError):
                        retry_after_seconds = None
                    cooldown = self._set_chutes_rate_limit_cooldown(
                        attempt=attempt,
                        retry_after_seconds=retry_after_seconds,
                    )
                    logger.warning("⏳ Chutes 429 cooldown set to %.2fs", cooldown)
                elif is_retryable:
                    self._record_chutes_event("retryable_error", status_code=status_code)
                    self._apply_chutes_adaptive_penalty(is_rate_limit=False)
                if is_retryable and self._should_switch_to_fallback(
                    attempt=attempt,
                    threshold=self.chutes_retries_before_fallback,
                    current_model=str(payload["model"]),
                ):
                    logger.warning(
                        "Retryable Chutes error threshold reached for model=%s; switching to fallback model=%s",
                        payload["model"],
                        self.chutes_fallback_model,
                    )
                    payload["model"] = self.chutes_fallback_model
                    continue
                if not is_retryable or attempt >= max_retries:
                    self._set_last_request_diagnostics(
                        retry_attempts=attempt,
                        last_status="error_non_retryable" if not is_retryable else "error_retry_exhausted",
                        circuit_broken=bool(self._get_disabled_reason()),
                        disable_reason=self._get_disabled_reason(),
                    )
                    raise LLMRequestError(
                        f"Chutes request failed (retryable={is_retryable}): {error_detail}",
                        retryable=is_retryable,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                retry_after_header = None
                if isinstance(e, httpx.HTTPStatusError) and e.response is not None:
                    retry_after_header = e.response.headers.get("Retry-After")

                try:
                    retry_after_seconds = float(retry_after_header) if retry_after_header else None
                except (TypeError, ValueError):
                    retry_after_seconds = None

                backoff_seconds = self._compute_chutes_backoff_seconds(
                    attempt=attempt,
                    retry_after_seconds=retry_after_seconds,
                    is_http_429=is_429,
                )
                if is_429 and self.chutes_rate_limit_cooldown_enabled:
                    # Cooldown wait is applied at the start of the next attempt; avoid double waiting here.
                    backoff_seconds = 0.0
                await asyncio.sleep(backoff_seconds)

        self._set_last_request_diagnostics(
            retry_attempts=max_retries + 1,
            last_status="error_exhausted",
            circuit_broken=bool(self._get_disabled_reason()),
            disable_reason=self._get_disabled_reason(),
        )
        raise LLMRequestError(
            f"Chutes request failed after {max_retries + 1} attempts: "
            f"{self._format_chutes_error(last_error) if last_error else 'unknown error'}",
            retryable=self._is_retryable_chutes_error(last_error) if last_error is not None else False,
            provider=self.provider,
            requested_model=model,
            runtime_model=self.chutes_model,
            status_code=(
                last_error.response.status_code
                if isinstance(last_error, httpx.HTTPStatusError) and last_error.response is not None
                else None
            ),
        )

    async def _query_chutes_non_stream(
        self,
        *,
        payload: Dict[str, Any],
        headers: Dict[str, str],
        timeout: httpx.Timeout,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json={**payload, "stream": False},
            )
            response.raise_for_status()

        data = response.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        raw_content = message.get("content", "")
        content = self._extract_text_parts(raw_content)
        structured_output = self._extract_structured_output(message.get("parsed"))
        if structured_output is None:
            structured_output = self._extract_structured_output(raw_content)
        reasoning_content = message.get("reasoning_content", "")
        if isinstance(reasoning_content, list):
            reasoning_content = "".join(
                part.get("text", "")
                for part in reasoning_content
                if isinstance(part, dict) and part.get("type") == "text"
            )
        return {
            "answer_text": content if isinstance(content, str) else "",
            "reasoning_text": reasoning_content if isinstance(reasoning_content, str) else "",
            "stop_reason": choice.get("finish_reason"),
            "usage": data.get("usage", {}),
            "chunk_count": 1,
            "raw_response": data,
            "structured_output": structured_output,
        }

    async def _query_chutes_streaming(
        self,
        *,
        payload: Dict[str, Any],
        headers: Dict[str, str],
        timeout: httpx.Timeout,
    ) -> Dict[str, Any]:
        answer_parts: List[str] = []
        reasoning_parts: List[str] = []
        structured_output: Optional[Dict[str, Any]] = None
        usage: Dict[str, Any] = {}
        stop_reason: Optional[str] = None
        chunk_count = 0
        raw_events: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json={**payload, "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if not line.startswith("data:"):
                        continue
                    data_line = line[len("data:"):].strip()
                    if not data_line:
                        continue
                    if data_line == "[DONE]":
                        break
                    try:
                        event = json.loads(data_line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(event, dict):
                        raw_events.append(event)
                    choice = (event.get("choices") or [{}])[0] if isinstance(event, dict) else {}
                    delta = choice.get("delta") or {}
                    content_piece = delta.get("content")
                    content_text = self._extract_text_parts(content_piece)
                    if content_text:
                        answer_parts.append(content_text)
                    if structured_output is None:
                        structured_output = self._extract_structured_output(delta.get("parsed"))
                    if structured_output is None and isinstance(choice.get("message"), dict):
                        structured_output = self._extract_structured_output(choice["message"].get("parsed"))
                    if structured_output is None:
                        structured_output = self._extract_structured_output(content_piece)
                    reasoning_piece = delta.get("reasoning_content")
                    reasoning_text = self._extract_text_parts(reasoning_piece)
                    if reasoning_text:
                        reasoning_parts.append(reasoning_text)
                    if choice.get("finish_reason") is not None:
                        stop_reason = choice.get("finish_reason")
                    if isinstance(event, dict) and isinstance(event.get("usage"), dict):
                        usage = event["usage"]
                    chunk_count += 1

        return {
            "answer_text": "".join(answer_parts),
            "reasoning_text": "".join(reasoning_parts),
            "stop_reason": stop_reason,
            "usage": usage,
            "chunk_count": chunk_count,
            "raw_response": {"events": raw_events},
            "structured_output": structured_output,
        }

    async def _query_chutes_anthropic(
        self,
        prompt: str,
        model: str,
        max_tokens: int,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        json_schema: Optional[Dict[str, Any]] = None,
        stream: Optional[bool] = None,
        max_retries_override: Optional[int] = None,
        empty_retries_before_fallback_override: Optional[int] = None,
        fast_fail_on_length: bool = False,
    ) -> Dict[str, Any]:
        """Query a Chutes Anthropic-compatible messages endpoint."""
        del json_schema
        disabled_reason = self._get_effective_disabled_reason()
        if disabled_reason:
            raise RuntimeError(f"Claude API disabled: {disabled_reason}")

        if not self.api_key:
            raise RuntimeError("CHUTES_API_KEY not configured")

        payload: Dict[str, Any] = {
            "model": self.chutes_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        if system_prompt:
            payload["system"] = system_prompt

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": os.getenv("CHUTES_ANTHROPIC_VERSION", "2023-06-01"),
            "content-type": "application/json",
        }

        last_error: Optional[Exception] = None

        max_retries = self.chutes_max_retries if max_retries_override is None else max(0, int(max_retries_override))
        for attempt in range(max_retries + 1):
            try:
                await self._wait_for_chutes_rate_limit_cooldown()
                timeout = httpx.Timeout(
                    timeout=self.chutes_timeout_seconds,
                    connect=min(self.chutes_timeout_seconds, 15.0),
                )
                async with self._chutes_request_semaphore:
                    await self._apply_chutes_request_throttle()
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        response = await client.post(
                            f"{self.base_url.rstrip('/')}/messages",
                            headers=headers,
                            json=payload,
                        )
                        response.raise_for_status()

                data = response.json()
                content_blocks = data.get("content") or []
                content = "".join(
                    block.get("text", "")
                    for block in content_blocks
                    if isinstance(block, dict) and block.get("type") == "text"
                )
                usage = data.get("usage", {})
                input_tokens = usage.get("input_tokens")
                output_tokens = usage.get("output_tokens")
                total_tokens = usage.get("total_tokens")
                structured_output = self._extract_structured_output(content_blocks)
                if structured_output is None:
                    structured_output = self._extract_structured_output(content)
                stop_reason = data.get("stop_reason")
                if str(stop_reason or "").strip().lower() == "length" and fast_fail_on_length:
                    self._record_chutes_event("success")
                    self._apply_chutes_adaptive_recovery()
                    self._set_last_request_diagnostics(retry_attempts=attempt, last_status="length_fast_fail")
                    return {
                        "content": "",
                        "reasoning_content": "",
                        "model_used": self.chutes_model,
                        "requested_model": model,
                        "provider": self.provider,
                        "structured_output": structured_output,
                        "raw_response": data,
                        "tokens_used": {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "total_tokens": total_tokens,
                        },
                        "stop_reason": stop_reason,
                        "inference_diagnostics": {
                            "length_fast_fail": True,
                            "fallback_used": False,
                        },
                    }
                if total_tokens is None and input_tokens is not None and output_tokens is not None:
                    total_tokens = input_tokens + output_tokens
                self._record_chutes_event("success")
                self._apply_chutes_adaptive_recovery()
                self._recover_chutes_rate_limit_cooldown()
                self._set_last_request_diagnostics(retry_attempts=attempt, last_status="ok")

                return {
                    "content": content,
                    "reasoning_content": "",
                    "model_used": self.chutes_model,
                    "requested_model": model,
                    "provider": self.provider,
                    "structured_output": structured_output,
                    "raw_response": data,
                    "tokens_used": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": total_tokens,
                    },
                    "stop_reason": stop_reason,
                }
            except Exception as e:
                last_error = e
                error_detail = self._format_chutes_error(e)
                logger.error(
                    "Chutes Anthropic API request failed (attempt %s/%s): %s",
                    attempt + 1,
                    max_retries + 1,
                    error_detail,
                )
                if self._is_insufficient_balance_error(e):
                    self.__class__._quota_circuit_trip_count += 1
                    cooldown = self._compute_quota_cooldown_seconds()
                    self._disable_api_with_kind("insufficient balance", kind="quota", cooldown_seconds=cooldown)
                    self._set_last_request_diagnostics(
                        retry_attempts=attempt,
                        last_status="insufficient_balance",
                        circuit_broken=True,
                        disable_reason=self._get_disabled_reason(),
                    )
                    raise LLMRequestError(
                        f"Chutes Anthropic insufficient balance: {error_detail}",
                        retryable=False,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                is_retryable = self._is_retryable_chutes_error(e)
                status_code = e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None
                is_429 = status_code == 429
                if is_429:
                    self._record_chutes_event("rate_limit", status_code=status_code)
                    self._apply_chutes_adaptive_penalty(is_rate_limit=True)
                    try:
                        retry_after_header = e.response.headers.get("Retry-After") if e.response is not None else None
                        retry_after_seconds = float(retry_after_header) if retry_after_header else None
                    except (TypeError, ValueError):
                        retry_after_seconds = None
                    cooldown = self._set_chutes_rate_limit_cooldown(
                        attempt=attempt,
                        retry_after_seconds=retry_after_seconds,
                    )
                    logger.warning("⏳ Chutes 429 cooldown set to %.2fs", cooldown)
                elif is_retryable:
                    self._record_chutes_event("retryable_error", status_code=status_code)
                    self._apply_chutes_adaptive_penalty(is_rate_limit=False)
                if not is_retryable or attempt >= max_retries:
                    self._set_last_request_diagnostics(
                        retry_attempts=attempt,
                        last_status="error_non_retryable" if not is_retryable else "error_retry_exhausted",
                        circuit_broken=bool(self._get_disabled_reason()),
                        disable_reason=self._get_disabled_reason(),
                    )
                    raise LLMRequestError(
                        f"Chutes Anthropic request failed (retryable={is_retryable}): {error_detail}",
                        retryable=is_retryable,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                retry_after_header = None
                if isinstance(e, httpx.HTTPStatusError) and e.response is not None:
                    retry_after_header = e.response.headers.get("Retry-After")

                try:
                    retry_after_seconds = float(retry_after_header) if retry_after_header else None
                except (TypeError, ValueError):
                    retry_after_seconds = None

                backoff_seconds = self._compute_chutes_backoff_seconds(
                    attempt=attempt,
                    retry_after_seconds=retry_after_seconds,
                    is_http_429=is_429,
                )
                if is_429 and self.chutes_rate_limit_cooldown_enabled:
                    backoff_seconds = 0.0
                await asyncio.sleep(backoff_seconds)

        self._set_last_request_diagnostics(
            retry_attempts=max_retries + 1,
            last_status="error_exhausted",
            circuit_broken=bool(self._get_disabled_reason()),
            disable_reason=self._get_disabled_reason(),
        )
        raise LLMRequestError(
            f"Chutes Anthropic request failed after {max_retries + 1} attempts: "
            f"{self._format_chutes_error(last_error) if last_error else 'unknown error'}",
            retryable=self._is_retryable_chutes_error(last_error) if last_error is not None else False,
            provider=self.provider,
            requested_model=model,
            runtime_model=self.chutes_model,
            status_code=(
                last_error.response.status_code
                if isinstance(last_error, httpx.HTTPStatusError) and last_error.response is not None
                else None
            ),
        )

    async def get_embedding(
        self,
        text: str,
        model: str = "claude-3-5-haiku-20241022"
    ) -> Optional[List[float]]:
        """
        Generate embedding for text using Claude API.

        Args:
            text: Text to embed
            model: Model to use for embedding

        Returns:
            Embedding vector as list of floats, or None if failed
        """
        try:
            import anthropic

            client = anthropic.Anthropic(
                api_key=self.api_key,
                base_url=self.base_url
            )

            response = client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": f"Generate a semantic embedding for this text: {text[:1000]}"
                }]
            )

            # Note: Claude API doesn't directly return embeddings
            # For production, use a dedicated embedding service
            # For now, return a mock embedding based on text hash
            return self._mock_embedding(text)

        except Exception as e:
            logger.warning(f"Failed to generate embedding: {e}")
            return self._mock_embedding(text)

    def _mock_embedding(self, text: str, dim: int = 1536) -> List[float]:
        """
        Generate a deterministic mock embedding from text.

        This is a fallback for when the embedding API is unavailable.
        Uses a hash-based approach to ensure consistency.

        Args:
            text: Text to embed
            dim: Dimension of embedding vector

        Returns:
            Mock embedding vector
        """
        import hashlib

        # Create hash of text
        hash_obj = hashlib.md5(text.encode())
        hash_hex = hash_obj.hexdigest()

        # Convert to float values between -1 and 1
        embedding = []
        for i in range(dim):
            # Use pairs of hex characters to generate values
            idx = (i * 2) % len(hash_hex)
            val = int(hash_hex[idx:idx+2], 16) / 255.0 * 2 - 1
            embedding.append(val)

        return embedding

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
