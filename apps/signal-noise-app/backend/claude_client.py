import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import os
import asyncio
from datetime import datetime
from dataclasses import dataclass
import httpx

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
        self.provider = self._resolve_provider()
        self.api_key = api_key or self._resolve_api_key()
        self.base_url = base_url or self._resolve_base_url()
        self.chutes_model = os.getenv("CHUTES_MODEL", "moonshotai/Kimi-K2.5-TEE")
        self.chutes_fallback_model = os.getenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
        self.chutes_timeout_seconds = float(os.getenv("CHUTES_TIMEOUT_SECONDS", "45"))
        self.chutes_fallback_timeout_seconds = float(os.getenv("CHUTES_FALLBACK_TIMEOUT_SECONDS", "90"))
        self.chutes_stream_idle_timeout_seconds = float(
            os.getenv("CHUTES_STREAM_IDLE_TIMEOUT_SECONDS", str(self.chutes_timeout_seconds))
        )
        self.chutes_stream_enabled = self._parse_bool_env(os.getenv("CHUTES_STREAM_ENABLED"), default=True)
        self.chutes_max_retries = int(os.getenv("CHUTES_MAX_RETRIES", "1"))

        disable_flag = (os.getenv("DISABLE_CLAUDE_API") or "").strip().lower()
        if disable_flag in {"1", "true", "yes", "on"}:
            self._disable_api("disabled by environment")

        if not self.api_key:
            logger.warning("⚠️ No LLM API key configured for selected provider - client will fail")

        self.default_model = "haiku"
        self.cascade_order = ["haiku", "sonnet", "opus"]

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

    @classmethod
    def _get_disabled_reason(cls) -> Optional[str]:
        return cls._api_disabled_reason

    @classmethod
    def _disable_api(cls, reason: str):
        if not cls._api_disabled_reason:
            cls._api_disabled_reason = reason
            logger.warning(f"⚠️ Disabling Claude API for current process: {reason}")

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
        system_prompt: Optional[str] = None
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
            )
        if self.provider == self.PROVIDER_CHUTES_ANTHROPIC:
            return await self._query_chutes_anthropic(
                prompt=prompt,
                model=model,
                max_tokens=max_tokens,
                system_prompt=system_prompt,
            )

        if not ANTHROPIC_SDK_AVAILABLE:
            raise ImportError("anthropic package is required. Install with: pip install anthropic")

        disabled_reason = self._get_disabled_reason()
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
    ) -> Dict[str, Any]:
        """
        Query a Chutes OpenAI-compatible model endpoint.

        The pipeline still calls this through the Claude client interface, but the
        transport is OpenAI chat completions and the model is configured via CHUTES_MODEL.
        """
        disabled_reason = self._get_disabled_reason()
        if disabled_reason:
            raise RuntimeError(f"Claude API disabled: {disabled_reason}")

        if not self.api_key:
            raise RuntimeError("CHUTES_API_KEY not configured")

        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.chutes_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7 if system_prompt is None else 0.4,
            "stream": self.chutes_stream_enabled,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_error: Optional[Exception] = None

        for attempt in range(self.chutes_max_retries + 1):
            try:
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
                if self.chutes_stream_enabled:
                    data = await self._query_chutes_streaming(
                        payload=payload,
                        headers=headers,
                        timeout=timeout,
                    )
                else:
                    data = await self._query_chutes_non_stream(
                        payload=payload,
                        headers=headers,
                        timeout=timeout,
                    )

                content = data.get("answer_text", "")
                reasoning_content = data.get("reasoning_text", "")
                usage = data.get("usage", {})
                stop_reason = data.get("stop_reason")
                chunk_count = int(data.get("chunk_count", 0) or 0)

                if not content and self.chutes_fallback_model and payload["model"] != self.chutes_fallback_model:
                    logger.warning(
                        "Chutes response returned empty content for model=%s finish_reason=%s; retrying with fallback model=%s",
                        payload["model"],
                        stop_reason,
                        self.chutes_fallback_model,
                    )
                    payload["model"] = self.chutes_fallback_model
                    continue

                return {
                    "content": content,
                    "model_used": payload["model"],
                    "requested_model": model,
                    "provider": self.provider,
                    "raw_response": data.get("raw_response"),
                    "tokens_used": {
                        "input_tokens": usage.get("prompt_tokens"),
                        "output_tokens": usage.get("completion_tokens"),
                        "total_tokens": usage.get("total_tokens"),
                    },
                    "stop_reason": stop_reason,
                    "inference_diagnostics": {
                        "streaming": bool(self.chutes_stream_enabled),
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
                    self.chutes_max_retries + 1,
                    error_detail,
                )
                if self._is_insufficient_balance_error(e):
                    self._disable_api("insufficient balance")
                    raise LLMRequestError(
                        f"Chutes insufficient balance: {error_detail}",
                        retryable=False,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                is_retryable = self._is_retryable_chutes_error(e)
                if (
                    is_retryable
                    and self.chutes_fallback_model
                    and payload["model"] != self.chutes_fallback_model
                ):
                    logger.warning(
                        "Retryable Chutes error for model=%s; switching to fallback model=%s",
                        payload["model"],
                        self.chutes_fallback_model,
                    )
                    payload["model"] = self.chutes_fallback_model
                    continue
                if not is_retryable or attempt >= self.chutes_max_retries:
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

                backoff_seconds = retry_after_seconds or min(2 ** attempt, 4)
                await asyncio.sleep(backoff_seconds)

        raise LLMRequestError(
            f"Chutes request failed after {self.chutes_max_retries + 1} attempts: "
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
        content = raw_content
        if isinstance(raw_content, list):
            content = "".join(
                part.get("text", "")
                for part in raw_content
                if isinstance(part, dict) and part.get("type") == "text"
            )
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
                    if isinstance(content_piece, str) and content_piece:
                        answer_parts.append(content_piece)
                    reasoning_piece = delta.get("reasoning_content")
                    if isinstance(reasoning_piece, str) and reasoning_piece:
                        reasoning_parts.append(reasoning_piece)
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
        }

    async def _query_chutes_anthropic(
        self,
        prompt: str,
        model: str,
        max_tokens: int,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query a Chutes Anthropic-compatible messages endpoint."""
        disabled_reason = self._get_disabled_reason()
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

        for attempt in range(self.chutes_max_retries + 1):
            try:
                timeout = httpx.Timeout(
                    timeout=self.chutes_timeout_seconds,
                    connect=min(self.chutes_timeout_seconds, 15.0),
                )
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
                if total_tokens is None and input_tokens is not None and output_tokens is not None:
                    total_tokens = input_tokens + output_tokens

                return {
                    "content": content,
                    "model_used": self.chutes_model,
                    "requested_model": model,
                    "provider": self.provider,
                    "raw_response": data,
                    "tokens_used": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": total_tokens,
                    },
                    "stop_reason": data.get("stop_reason"),
                }
            except Exception as e:
                last_error = e
                error_detail = self._format_chutes_error(e)
                logger.error(
                    "Chutes Anthropic API request failed (attempt %s/%s): %s",
                    attempt + 1,
                    self.chutes_max_retries + 1,
                    error_detail,
                )
                if self._is_insufficient_balance_error(e):
                    self._disable_api("insufficient balance")
                    raise LLMRequestError(
                        f"Chutes Anthropic insufficient balance: {error_detail}",
                        retryable=False,
                        provider=self.provider,
                        requested_model=model,
                        runtime_model=self.chutes_model,
                        status_code=(e.response.status_code if isinstance(e, httpx.HTTPStatusError) and e.response is not None else None),
                    ) from e

                is_retryable = self._is_retryable_chutes_error(e)
                if not is_retryable or attempt >= self.chutes_max_retries:
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

                backoff_seconds = retry_after_seconds or min(2 ** attempt, 4)
                await asyncio.sleep(backoff_seconds)

        raise LLMRequestError(
            f"Chutes Anthropic request failed after {self.chutes_max_retries + 1} attempts: "
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
