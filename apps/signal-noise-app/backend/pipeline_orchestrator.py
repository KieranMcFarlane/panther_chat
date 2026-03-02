#!/usr/bin/env python3
"""
Canonical entity pipeline orchestrator.

This is the single backend entry point intended to run an entity through:
1. dossier generation
2. dossier-guided discovery
3. Ralph validation
4. temporal persistence
5. dashboard scoring
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlparse


@dataclass
class PipelineArtifacts:
    dossier: Dict[str, Any]
    discovery_result: Any
    validated_signals: List[Dict[str, Any]]
    episodes: List[Dict[str, Any]]
    scores: Dict[str, Any]


class PipelineOrchestrator:
    def __init__(
        self,
        dossier_generator,
        discovery,
        ralph_validator,
        graphiti_service,
        dashboard_scorer,
    ):
        self.dossier_generator = dossier_generator
        self.discovery = discovery
        self.ralph_validator = ralph_validator
        self.graphiti_service = graphiti_service
        self.dashboard_scorer = dashboard_scorer

    async def run_entity_pipeline(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        initial_dossier: Optional[Dict[str, Any]] = None,
        phase_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None,
    ) -> Dict[str, Any]:
        phase_results: Dict[str, Dict[str, Any]] = {
            "dossier_generation": {"status": "pending"},
            "discovery": {"status": "pending"},
            "ralph_validation": {"status": "pending"},
            "temporal_persistence": {"status": "pending"},
            "dashboard_scoring": {"status": "pending"},
        }
        dossier = initial_dossier
        if dossier is None:
            await self._emit_phase_update(phase_callback, "dossier_generation", {"status": "running"})
            dossier = await self._run_dossier_generation(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
            )
            await self._emit_phase_update(
                phase_callback,
                "dossier_generation",
                {
                    "status": "completed",
                    "hypothesis_count": dossier.get("metadata", {}).get("hypothesis_count", 0),
                    "signal_count": dossier.get("metadata", {}).get("signal_count", 0),
                },
            )
            phase_results["dossier_generation"] = {
                "status": "completed",
                "hypothesis_count": dossier.get("metadata", {}).get("hypothesis_count", 0),
                "signal_count": dossier.get("metadata", {}).get("signal_count", 0),
            }
        else:
            phase_results["dossier_generation"] = {"status": "completed"}

        discovery_result: Any = {"signals_discovered": [], "hypotheses": []}
        raw_signals: List[Dict[str, Any]] = []
        ralph_result: Dict[str, Any] = self._coerce_ralph_result([])
        validated_signals: List[Dict[str, Any]] = []
        capability_signals: List[Dict[str, Any]] = []
        validated_rfps: List[Dict[str, Any]] = []
        episodes: List[Dict[str, Any]] = []

        try:
            await self._emit_phase_update(phase_callback, "discovery", {"status": "running"})
            discovery_result = await self._run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                dossier=dossier,
            )
            raw_signals = self._extract_raw_signals(discovery_result)
            phase_results["discovery"] = {
                "status": "completed",
                "signals_discovered": len(raw_signals),
                "final_confidence": getattr(discovery_result, "final_confidence", None),
            }
            await self._emit_phase_update(phase_callback, "discovery", phase_results["discovery"])

            await self._emit_phase_update(phase_callback, "ralph_validation", {"status": "running"})
            raw_ralph_result = await self._run_ralph_validation(
                entity_id=entity_id,
                raw_signals=raw_signals,
            )
            ralph_result = self._coerce_ralph_result(raw_ralph_result)
            validated_signals = self._normalize_validated_signals(ralph_result.get("validated_signals", []))
            capability_signals = self._normalize_validated_signals(ralph_result.get("capability_signals", []))
            validated_rfps = [signal for signal in validated_signals if self._is_rfp_signal(signal)]
            phase_results["ralph_validation"] = {
                "status": "completed",
                "validated_signal_count": len(validated_signals),
                "capability_signal_count": len(capability_signals),
                "rfp_count": len(validated_rfps),
            }
            await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])

            await self._emit_phase_update(phase_callback, "temporal_persistence", {"status": "running"})
            episodes = await self._run_temporal_persistence(
                entity_id=entity_id,
                entity_name=entity_name,
                validated_signals=validated_signals,
            )
            phase_results["temporal_persistence"] = {
                "status": "completed",
                "episode_count": len(episodes),
            }
            await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
        except Exception as exc:
            phase_results["discovery"] = {"status": "failed", "error": str(exc)}
            phase_results["ralph_validation"] = {"status": "skipped", "reason": "discovery_failed"}
            phase_results["temporal_persistence"] = {"status": "skipped", "reason": "discovery_failed"}
            await self._emit_phase_update(phase_callback, "discovery", phase_results["discovery"])
            await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
            await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])

        await self._emit_phase_update(phase_callback, "dashboard_scoring", {"status": "running"})
        scores = await self._run_dashboard_scoring(
            entity_id=entity_id,
            entity_name=entity_name,
            discovery_result=discovery_result,
            validated_signals=validated_signals,
            validated_rfps=validated_rfps,
            episodes=episodes,
        )
        await self._emit_phase_update(
            phase_callback,
            "dashboard_scoring",
            {
                "status": "completed",
                "sales_readiness": scores.get("sales_readiness"),
                "active_probability": scores.get("active_probability"),
                "procurement_maturity": scores.get("procurement_maturity"),
            },
        )
        phase_results["dashboard_scoring"] = {
            "status": "completed",
            "sales_readiness": scores.get("sales_readiness"),
            "active_probability": scores.get("active_probability"),
            "procurement_maturity": scores.get("procurement_maturity"),
        }

        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "phases": phase_results,
            "validated_signal_count": len(validated_signals),
            "capability_signal_count": len(capability_signals),
            "rfp_count": len(validated_rfps),
            "sales_readiness": scores.get("sales_readiness"),
            "artifacts": {
                "dossier_id": entity_id,
                "dossier": dossier,
                "discovery_result": self._serialize_discovery_result(discovery_result),
                "validated_signals": validated_signals,
                "capability_signals": capability_signals,
                "episodes": episodes,
                "scores": scores,
                "hypothesis_states": ralph_result.get("hypothesis_states", {}),
            },
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _run_dossier_generation(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        priority_score: int,
    ) -> Dict[str, Any]:
        return await self.dossier_generator.generate_universal_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=priority_score,
        )

    async def _run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
    ):
        return await self.discovery.run_discovery_with_dossier_context(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
        )

    async def _run_ralph_validation(
        self,
        entity_id: str,
        raw_signals: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return await self.ralph_validator.validate_signals(raw_signals, entity_id)

    async def _run_temporal_persistence(
        self,
        entity_id: str,
        entity_name: str,
        validated_signals: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        episodes: List[Dict[str, Any]] = []

        for signal in validated_signals:
            if self._is_rfp_signal(signal):
                episode = await self.graphiti_service.add_rfp_episode({
                    "rfp_id": signal.get("id") or f"{entity_id}-rfp",
                    "organization": entity_name,
                    "entity_type": "Entity",
                    "title": signal.get("statement") or signal.get("text") or "Validated RFP signal",
                    "url": signal.get("url"),
                    "confidence_score": signal.get("confidence"),
                    "metadata": {
                        "entity_id": entity_id,
                        "signal_type": signal.get("type"),
                    },
                })
                episodes.append(episode)
                if hasattr(self.graphiti_service, "persist_unified_rfp"):
                    await self.graphiti_service.persist_unified_rfp(
                        self._build_unified_rfp_record(
                            entity_id=entity_id,
                            entity_name=entity_name,
                            signal=signal,
                            episode=episode,
                        )
                    )
            elif hasattr(self.graphiti_service, "add_discovery_episode"):
                episode = await self.graphiti_service.add_discovery_episode(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    episode_type=signal.get("type", "DISCOVERY_SIGNAL"),
                    content=signal.get("statement") or signal.get("text") or "Validated discovery signal",
                    source="pipeline_orchestrator",
                    confidence=signal.get("confidence"),
                )
                episodes.append(episode)

        if hasattr(self.graphiti_service, "get_entity_timeline"):
            return await self.graphiti_service.get_entity_timeline(entity_id, limit=50)

        return episodes

    async def _run_dashboard_scoring(
        self,
        entity_id: str,
        entity_name: str,
        discovery_result: Any,
        validated_signals: List[Dict[str, Any]],
        validated_rfps: List[Dict[str, Any]],
        episodes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        hypotheses = getattr(discovery_result, "hypotheses", [])
        return await self.dashboard_scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=hypotheses,
            signals=validated_signals,
            episodes=episodes,
            validated_rfps=validated_rfps,
        )

    def _extract_raw_signals(self, discovery_result: Any) -> List[Dict[str, Any]]:
        if isinstance(discovery_result, dict):
            return discovery_result.get("signals_discovered", [])
        return getattr(discovery_result, "signals_discovered", [])

    async def _emit_phase_update(
        self,
        callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]],
        phase: str,
        payload: Dict[str, Any],
    ) -> None:
        if callback is not None:
            await callback(phase, payload)

    def _coerce_ralph_result(self, result: Any) -> Dict[str, Any]:
        if isinstance(result, dict):
            return result

        if isinstance(result, list):
            return {
                "validated_signals": result,
                "capability_signals": [],
                "hypothesis_states": {},
            }

        return {
            "validated_signals": [],
            "capability_signals": [],
            "hypothesis_states": {},
        }

    def _normalize_validated_signals(self, signals: List[Any]) -> List[Dict[str, Any]]:
        normalized_signals: List[Dict[str, Any]] = []

        for signal in signals:
            if isinstance(signal, dict):
                normalized_signals.append(signal)
                continue

            signal_type = getattr(signal, "signal_class", None) or getattr(getattr(signal, "type", None), "value", None) or getattr(signal, "type", None)
            subtype = getattr(getattr(signal, "subtype", None), "value", None) or getattr(signal, "subtype", None)
            text = getattr(signal, "statement", None) or getattr(signal, "text", None) or getattr(signal, "summary", None)
            if not text:
                metadata = getattr(signal, "metadata", {}) or {}
                text = metadata.get("statement") or metadata.get("text") or metadata.get("summary")

            normalized_signals.append({
                "id": getattr(signal, "id", None),
                "type": signal_type,
                "subtype": subtype,
                "confidence": getattr(signal, "confidence", None),
                "statement": text,
                "text": text,
                "url": getattr(signal, "source_url", None),
                "entity_id": getattr(signal, "entity_id", None),
                "metadata": getattr(signal, "metadata", {}) or {},
            })

        return normalized_signals

    def _serialize_discovery_result(self, discovery_result: Any) -> Dict[str, Any]:
        if isinstance(discovery_result, dict):
            return discovery_result

        return {
            "final_confidence": getattr(discovery_result, "final_confidence", None),
            "iterations_completed": getattr(discovery_result, "iterations_completed", None),
            "signals_discovered": getattr(discovery_result, "signals_discovered", []),
            "hypotheses": getattr(discovery_result, "hypotheses", []),
        }

    def _build_unified_rfp_record(
        self,
        entity_id: str,
        entity_name: str,
        signal: Dict[str, Any],
        episode: Dict[str, Any],
    ) -> Dict[str, Any]:
        confidence = signal.get("confidence")
        if isinstance(confidence, (int, float)) and confidence > 1:
            confidence = confidence / 100.0

        title = signal.get("statement") or signal.get("text") or "Validated RFP signal"
        return {
            "rfp_id": signal.get("id") or f"{entity_id}-rfp",
            "title": title,
            "organization": entity_name,
            "description": title,
            "source": "ai-detected",
            "source_url": signal.get("url"),
            "category": signal.get("subtype") or signal.get("type") or "general",
            "status": "detected",
            "priority": "high" if (confidence or 0) >= 0.8 else "medium",
            "priority_score": 8 if (confidence or 0) >= 0.8 else 6,
            "confidence_score": confidence,
            "confidence": int(round((confidence or 0) * 100)),
            "yellow_panther_fit": 80 if self._is_rfp_signal(signal) else 60,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": signal.get("entity_type") or "CLUB",
            "location": self._extract_location_from_url(signal.get("url")),
            "tags": ["imported-entity", "pipeline-generated"],
            "keywords": self._extract_keywords(title),
            "metadata": {
                "episode_id": episode.get("episode_id"),
                "signal_id": signal.get("id"),
                "pipeline_source": "entity_import_pipeline",
                "signal_type": signal.get("type"),
            },
        }

    def _extract_keywords(self, text: str) -> List[str]:
        words = [word.strip(".,:;()[]{}").lower() for word in text.split()]
        return [word for word in words if len(word) > 3][:8]

    def _extract_location_from_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None

        hostname = urlparse(url).hostname
        return hostname or None

    def _is_rfp_signal(self, signal: Dict[str, Any]) -> bool:
        signal_type = str(signal.get("type") or signal.get("signal_type") or "").upper()
        text = str(signal.get("statement") or signal.get("text") or "").upper()
        return "RFP" in signal_type or "RFP" in text or "PROCUREMENT" in signal_type
