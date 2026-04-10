#!/usr/bin/env python3
"""
Tests for the canonical entity pipeline orchestrator.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pipeline_orchestrator import PipelineOrchestrator
from pipeline_run_metadata import merge_pipeline_run_metadata


class FakeDossierGenerator:
    async def generate_universal_dossier(self, **kwargs):
        return {
            "metadata": {
                "entity_id": kwargs["entity_id"],
                "hypothesis_count": 1,
                "signal_count": 1,
            },
            "questions": [],
            "procurement_signals": {
                "upcoming_opportunities": [
                    {
                        "opportunity": "CRM replacement",
                        "rfp_probability": 80,
                        "timeline": "Q3 2026",
                    }
                ]
            },
            "extracted_signals": [
                {
                    "type": "[PROCUREMENT]",
                    "insight": "CRM replacement likely",
                    "confidence": 80,
                }
            ],
        }


class FakeDiscoveryResult:
    def __init__(self):
        self.final_confidence = 0.78
        self.iterations_completed = 3
        self.signals_discovered = [
            {
                "signal_type": "RFP_DETECTED",
                "statement": "Confirmed procurement activity",
                "confidence": 0.82,
                "url": "https://example.com/rfp",
            }
        ]
        self.hypotheses = [
            {
                "statement": "Entity is in market for CRM",
                "confidence": 0.78,
                "category": "PROCUREMENT",
            }
        ]


class FakeDiscovery:
    async def run_discovery_with_dossier_context(self, **kwargs):
        return FakeDiscoveryResult()


class FakeDiscoveryManySignals:
    async def run_discovery_with_dossier_context(self, **kwargs):
        result = FakeDiscoveryResult()
        result.signals_discovered = [
            {
                "signal_type": "TECHNOLOGY_ADOPTED",
                "statement": f"Raw discovery signal {idx}",
                "confidence": 0.81,
                "url": f"https://example.com/signal/{idx}",
            }
            for idx in range(5)
        ]
        return result


class FakeDiscoveryHybridSignals:
    async def run_discovery_with_dossier_context(self, **kwargs):
        result = FakeDiscoveryResult()
        result.provisional_signals = [
            {
                "signal_type": "DISCOVERY_SIGNAL",
                "validation_state": "provisional",
                "statement": "Provisional entity-grounded signal A",
                "confidence": 0.66,
                "url": "https://example.com/news/a",
            },
            {
                "signal_type": "DISCOVERY_SIGNAL",
                "validation_state": "provisional",
                "statement": "Provisional entity-grounded signal B",
                "confidence": 0.64,
                "url": "https://example.com/news/b",
            },
        ]
        result.performance_summary = {"schema_fail_count": 0}
        return result


class FakeRalph:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-rfp",
                "type": "RFP_DETECTED",
                "confidence": 0.85,
                "statement": "Validated RFP signal",
                "url": "https://example.com/rfp",
            }
        ]


class FakeRalphNonRfp:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-signal",
                "type": "TECHNOLOGY_ADOPTED",
                "confidence": 0.74,
                "statement": "Adopted new CRM workflow",
                "url": "https://example.com/news/crm",
            }
        ]


class FakeRalphEmpty:
    async def validate_signals(self, raw_signals, entity_id):
        return []


class FakeRalphHybrid:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-min",
                "type": "DISCOVERY_SIGNAL",
                "confidence": 0.72,
                "statement": "Validated minimum signal",
                "url": "https://example.com/validated",
                "validation_state": "validated",
                "accept_guard_passed": True,
                "evidence_pointer_ids": ["ev:abc123"],
            }
        ]


class FakeGraphiti:
    def __init__(self):
        self.episodes = []
        self.signals = []
        self.homepage_insights = []

    async def upsert_signal(self, signal):
        self.signals.append(signal)
        return {"signal_id": getattr(signal, "id", "signal-1")}

    async def add_rfp_episode(self, rfp_data):
        self.episodes.append(rfp_data)
        return {"episode_id": "episode-1"}

    async def add_discovery_episode(self, **kwargs):
        self.episodes.append(kwargs)
        return {"episode_id": "episode-discovery-1"}

    async def get_entity_timeline(self, entity_id, limit=50):
        return self.episodes[:limit]

    async def materialize_homepage_insight(self, run_result):
        self.homepage_insights.append(run_result)
        return {
            "status": "materialized",
            "insight_id": f"{run_result['run_id']}:{run_result['entity_id']}",
            "entity_id": run_result["entity_id"],
            "entity_name": run_result["entity_name"],
            "materialized_at": "2026-03-30T00:00:00+00:00",
        }


class StrictDiscoveryGraphiti(FakeGraphiti):
    async def add_discovery_episode(
        self,
        entity_id,
        entity_name,
        entity_type,
        episode_type,
        description,
        source="discovery",
        url=None,
        confidence=0.5,
        evidence_date=None,
        metadata=None,
    ):
        self.episodes.append(
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "episode_type": episode_type,
                "description": description,
                "source": source,
                "url": url,
                "confidence": confidence,
                "metadata": metadata or {},
            }
        )
        return {"episode_id": "episode-discovery-1"}


class FakeDashboardScorer:
    async def calculate_entity_scores(self, **kwargs):
        return {
            "procurement_maturity": 74.0,
            "active_probability": 0.81,
            "sales_readiness": "LIVE",
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }


class FakePersistenceCoordinator:
    async def persist_run_artifacts(self, **kwargs):
        return {
            "dual_write_ok": True,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": True, "attempts": 1},
            "reconcile_required": False,
            "reconciliation_payload": None,
        }

    async def persist_step_artifacts(self, **kwargs):
        artifacts = kwargs.get("artifacts") or []
        return {
            "total_count": len(artifacts),
            "persisted_count": len(artifacts),
            "failed_count": 0,
            "dual_write_ok": True,
            "status_matrix": [],
            "reconcile_required": False,
            "reconciliation_payloads": [],
            "failure_taxonomy": {
                "supabase_write_failure": 0,
                "falkordb_write_failure": 0,
                "dual_write_incomplete": 0,
            },
        }


class FakePersistenceCoordinatorFail:
    async def persist_run_artifacts(self, **kwargs):
        return {
            "dual_write_ok": False,
            "supabase": {"ok": False, "attempts": 3, "error_class": "timeout"},
            "falkordb": {"ok": True, "attempts": 1},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "k"},
        }

    async def persist_step_artifacts(self, **kwargs):
        artifacts = kwargs.get("artifacts") or []
        return {
            "total_count": len(artifacts),
            "persisted_count": 0,
            "failed_count": len(artifacts),
            "dual_write_ok": False,
            "status_matrix": [],
            "reconcile_required": True,
            "reconciliation_payloads": [{"idempotency_key": "step-k"}],
            "failure_taxonomy": {
                "supabase_write_failure": len(artifacts),
                "falkordb_write_failure": 0,
                "dual_write_incomplete": 1 if artifacts else 0,
            },
        }


class FakePersistenceCoordinatorFalkorFail:
    async def persist_run_artifacts(self, **kwargs):
        return {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "run-k"},
        }

    async def persist_step_artifacts(self, **kwargs):
        artifacts = kwargs.get("artifacts") or []
        return {
            "total_count": len(artifacts),
            "persisted_count": len(artifacts),
            "failed_count": len(artifacts),
            "dual_write_ok": False,
            "status_matrix": [],
            "reconcile_required": True,
            "reconciliation_payloads": [{"idempotency_key": "step-k"}],
            "failure_taxonomy": {
                "supabase_write_failure": 0,
                "falkordb_write_failure": len(artifacts),
            "dual_write_incomplete": 1 if artifacts else 0,
            },
        }


class CapturingPersistenceCoordinator(FakePersistenceCoordinator):
    def __init__(self):
        self.run_payloads = []

    async def persist_run_artifacts(self, **kwargs):
        self.run_payloads.append(kwargs)
        return await super().persist_run_artifacts(**kwargs)


@pytest.mark.asyncio
async def test_pipeline_orchestrator_runs_phases_and_returns_artifacts():
    phase_events = []

    async def phase_callback(phase, payload):
        phase_events.append((phase, payload["status"]))
        if phase == "dossier_generation" and payload["status"] == "question_first_completed":
            question_first_calls["phase_payload"] = dict(payload)

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
        phase_callback=phase_callback,
    )

    assert result["entity_id"] == "arsenal-fc"
    assert result["phases"]["dossier_generation"]["status"] == "completed"
    assert result["phases"]["discovery"]["status"] == "completed"
    assert result["phases"]["ralph_validation"]["status"] == "completed"
    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    assert result["phases"]["dashboard_scoring"]["status"] == "completed"
    assert result["validated_signal_count"] == 1
    assert result["rfp_count"] == 1
    assert result["sales_readiness"] == "LIVE"
    assert result["phase_details_by_phase"]["discovery"]["status"] == "completed"
    assert result["acceptance_gate"]["passed"] is False
    assert "signals_below_threshold" in result["acceptance_gate"]["reasons"]
    assert result["failure_taxonomy"]["low_signal_content"] == 1
    assert result["run_profile"] == "bounded_production"
    assert result["degraded_mode"] is False
    assert result["dual_write_ok"] is True
    assert result["persistence_status"]["supabase"]["ok"] is True
    assert ("discovery", "running") in phase_events
    assert ("dashboard_scoring", "completed") in phase_events


@pytest.mark.asyncio
async def test_pipeline_orchestrator_materializes_homepage_insight_after_run():
    graphiti = FakeGraphiti()
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=graphiti,
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )

    assert result["homepage_materialization"]["status"] == "materialized"
    assert len(graphiti.homepage_insights) == 1
    assert graphiti.homepage_insights[0]["entity_id"] == "arsenal-fc"
    assert graphiti.homepage_insights[0]["scores"]["sales_readiness"] == "LIVE"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_emits_phase_boundary_logs(caplog):
    caplog.set_level("WARNING")

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )

    messages = [record.message for record in caplog.records]
    assert any("Pipeline boundary: orchestrator:start" in message for message in messages)
    assert any("Pipeline boundary: discovery:start" in message for message in messages)
    assert any("Pipeline boundary: discovery:complete" in message for message in messages)
    assert any("Pipeline boundary: dashboard_scoring:complete" in message for message in messages)
    assert any("Pipeline boundary: orchestrator:complete" in message for message in messages)


@pytest.mark.asyncio
async def test_pipeline_orchestrator_uses_dossier_objective_override(monkeypatch):
    monkeypatch.setenv("PIPELINE_DOSSIER_OBJECTIVE", "leadership_enrichment")

    captured = {}

    class CaptureDossierGenerator(FakeDossierGenerator):
        async def generate_universal_dossier(self, **kwargs):
            captured.update(kwargs)
            return await super().generate_universal_dossier(**kwargs)

    orchestrator = PipelineOrchestrator(
        dossier_generator=CaptureDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    await orchestrator.run_entity_pipeline(
        entity_id="leedsunited",
        entity_name="Leeds United",
        entity_type="CLUB",
        priority_score=95,
        run_objective="rfp_web",
    )

    assert captured["run_objective"] == "leadership_enrichment"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_preserves_procurement_discovery_for_phase_split():
    captured = {}

    class CaptureDossierGenerator(FakeDossierGenerator):
        async def generate_universal_dossier(self, **kwargs):
            captured["dossier_run_objective"] = kwargs.get("run_objective")
            return await super().generate_universal_dossier(**kwargs)

    class CaptureDiscovery(FakeDiscovery):
        async def run_discovery_with_dossier_context(self, **kwargs):
            captured["discovery_run_objective"] = kwargs.get("run_objective")
            return await super().run_discovery_with_dossier_context(**kwargs)

    orchestrator = PipelineOrchestrator(
        dossier_generator=CaptureDossierGenerator(),
        discovery=CaptureDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    await orchestrator.run_entity_pipeline(
        entity_id="major-league-cricket",
        entity_name="Major League Cricket",
        entity_type="LEAGUE",
        priority_score=82,
        run_objective="procurement_discovery",
    )

    assert captured["dossier_run_objective"] == "leadership_enrichment"
    assert captured["discovery_run_objective"] == "procurement_discovery"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_enriches_dossier_with_question_first(monkeypatch):
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "false")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_MAX_QUESTIONS", "1")

    import question_first_dossier_runner as question_first_runner
    try:
        import backend.question_first_dossier_runner as backend_question_first_runner
    except ModuleNotFoundError:
        import question_first_dossier_runner as backend_question_first_runner

    question_first_calls = {}

    async def fake_run_question_first_dossier_from_payload(**kwargs):
        question_first_calls["source_payload"] = kwargs["source_payload"]
        payload = dict(kwargs["source_payload"])
        payload["question_first_run_path"] = "leedsunited_question_first_run.json"
        payload["question_first_run"] = {
            "schema_version": "question_first_run_v1",
            "generated_at": "2026-03-25T00:00:00+00:00",
            "run_started_at": "2026-03-25T00:00:00+00:00",
            "source": "opencode_agentic_batch",
            "status": "ready",
        }
        payload["question_first"] = {
            "enabled": True,
            "schema_version": "question_first_run_v1",
            "questions_answered": 1,
            "connections_graph_enrichment_enabled": False,
            "connections_graph_enrichment_status": "optional",
            "categories": [
                {
                    "category": "identity",
                    "question_count": 1,
                    "validated_count": 1,
                    "pending_count": 0,
                    "no_signal_count": 0,
                    "retry_count": 0,
                }
            ],
            "answers": [
                {
                    "question_id": "q1",
                    "section_id": "core_information",
                    "question_text": "When was Leeds United founded?",
                    "search_query": '"Leeds United" When was Leeds United founded',
                    "search_hit": True,
                    "search_results_count": 1,
                    "scrape_url": "https://www.leedsunited.com/",
                    "answer": "1919",
                    "confidence": 0.95,
                    "evidence_url": "https://www.leedsunited.com/",
                    "reasoning_model_used": "opencode",
                    "retry_count": 0,
                    "category": "identity",
                    "search_queries": ['"Leeds United" When was Leeds United founded'],
                    "search_attempts": [{"query": '"Leeds United" When was Leeds United founded', "status": "success", "result_count": 1}],
                }
            ],
            "report": payload["question_first_run"],
        }
        questions = payload.get("questions") or []
        if questions:
            questions[0] = dict(questions[0])
            questions[0]["answer"] = "1919"
            questions[0]["validation_state"] = "validated"
            questions[0]["question_first_answer"] = payload["question_first"]["answers"][0]
        payload["questions"] = questions
        return payload

    monkeypatch.setattr(question_first_runner, "run_question_first_dossier_from_payload", fake_run_question_first_dossier_from_payload)
    monkeypatch.setattr(backend_question_first_runner, "run_question_first_dossier_from_payload", fake_run_question_first_dossier_from_payload)

    class QuestionFirstDossierGenerator(FakeDossierGenerator):
        async def generate_universal_dossier(self, **kwargs):
            question_first_calls["dossier_run_objective"] = kwargs.get("run_objective")
            payload = await super().generate_universal_dossier(**kwargs)
            payload["questions"] = [
                {
                    "question_id": "q1",
                    "section_id": "core_information",
                    "question_text": "When was Leeds United founded?",
                    "search_strategy": {"search_queries": ['"Leeds United" founded']},
                }
            ]
            return payload

    orchestrator = PipelineOrchestrator(
        dossier_generator=QuestionFirstDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
        brightdata_client=None,
        claude_client=None,
    )

    async def phase_callback(phase, payload):
        if phase == "dossier_generation" and payload["status"] == "question_first_completed":
            question_first_calls["phase_payload"] = dict(payload)

    result = await orchestrator.run_entity_pipeline(
        entity_id="leedsunited",
        entity_name="Leeds United",
        entity_type="CLUB",
        priority_score=95,
        phase_callback=phase_callback,
    )

    assert question_first_calls["dossier_run_objective"] == "leadership_enrichment"
    assert question_first_calls["source_payload"]["questions"][0]["question_text"] == "When was Leeds United founded?"
    assert result["artifacts"]["dossier"]["question_first"]["questions_answered"] == 1
    assert result["artifacts"]["dossier"]["question_first"]["connections_graph_enrichment_enabled"] is False
    assert result["artifacts"]["dossier"]["question_first"]["connections_graph_enrichment_status"] == "optional"
    assert question_first_calls["phase_payload"]["connections_graph_enrichment_enabled"] is False
    assert question_first_calls["phase_payload"]["connections_graph_enrichment_status"] == "optional"
    assert result["artifacts"]["dossier"]["questions"][0]["validation_state"] == "validated"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_forwards_question_repair_metadata(monkeypatch):
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "false")

    import question_first_dossier_runner as question_first_runner
    try:
        import backend.question_first_dossier_runner as backend_question_first_runner
    except ModuleNotFoundError:
        import question_first_dossier_runner as backend_question_first_runner

    captured = {}

    async def fake_run_question_first_dossier_from_payload(**kwargs):
        captured["source_payload"] = kwargs["source_payload"]
        captured["launch_source_payload"] = kwargs.get("launch_source_payload")
        payload = dict(kwargs["source_payload"])
        payload["question_first"] = {
            "enabled": True,
            "schema_version": "question_first_run_v2",
            "questions_answered": 15,
            "answers": [],
            "categories": [],
        }
        payload["question_first_run"] = {
            "schema_version": "question_first_run_v2",
            "generated_at": "2026-04-10T08:00:00+00:00",
            "run_started_at": "2026-04-10T08:00:00+00:00",
            "source": "opencode_agentic_batch",
            "status": "ready",
        }
        return payload

    monkeypatch.setattr(question_first_runner, "run_question_first_dossier_from_payload", fake_run_question_first_dossier_from_payload)
    monkeypatch.setattr(backend_question_first_runner, "run_question_first_dossier_from_payload", fake_run_question_first_dossier_from_payload)

    class RepairAwareDossierGenerator(FakeDossierGenerator):
        async def generate_universal_dossier(self, **kwargs):
            payload = await super().generate_universal_dossier(**kwargs)
            payload["questions"] = [
                {"question_id": "q11_decision_owner", "question_text": "Who is the best buyer?"},
                {"question_id": "q12_connections", "question_text": "Who knows them?", "depends_on": ["q11_decision_owner"]},
            ]
            return payload

    orchestrator = PipelineOrchestrator(
        dossier_generator=RepairAwareDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
        brightdata_client=None,
        claude_client=None,
    )

    await orchestrator.run_entity_pipeline(
        entity_id="fc-porto-2027",
        entity_name="FC Porto",
        entity_type="SPORT_CLUB",
        priority_score=91,
        run_objective="leadership_enrichment",
        request_metadata={
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": True,
            "repair_source_run_id": "fc-porto-base-run",
        },
    )

    repair_meta = captured["source_payload"].get("metadata", {}).get("question_first_repair")
    assert repair_meta["mode"] == "question"
    assert repair_meta["question_id"] == "q11_decision_owner"
    assert repair_meta["cascade_dependents"] is True
    assert repair_meta["repair_source_run_id"] == "fc-porto-base-run"
    assert repair_meta["repaired_question_ids"] == ["q11_decision_owner", "q12_connections"]
    assert [question["question_id"] for question in captured["launch_source_payload"]["questions"]] == [
        "q11_decision_owner",
        "q12_connections",
    ]


@pytest.mark.asyncio
async def test_pipeline_orchestrator_enriches_initial_dossier_with_question_first(monkeypatch):
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "false")

    async def fake_run_question_first_enrichment(self, *, dossier, entity_id, entity_name, request_metadata):
        payload = dict(dossier)
        payload["question_first"] = {
            "enabled": True,
            "schema_version": "question_first_run_v2",
            "questions_answered": 2,
            "quality_state": "blocked",
            "answers": [
                {"question_id": "q11_decision_owner", "status": "no_signal"},
                {"question_id": "q12_connections", "status": "blocked"},
            ],
            "categories": [],
        }
        payload["questions"] = [
            {"question_id": "q11_decision_owner", "status": "no_signal"},
                {"question_id": "q12_connections", "status": "blocked", "depends_on": ["q11_decision_owner"]},
            ]
        return payload

    monkeypatch.setattr(PipelineOrchestrator, "_run_question_first_enrichment", fake_run_question_first_enrichment)

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
        brightdata_client=None,
        claude_client=None,
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="fc-porto-2027",
        entity_name="FC Porto",
        entity_type="SPORT_CLUB",
        priority_score=91,
        initial_dossier={
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
            "metadata": {"generation_mode": "timeout_degraded"},
        },
        request_metadata={
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": True,
        },
    )

    assert result["artifacts"]["dossier"]["question_first"]["questions_answered"] == 2
    assert result["artifacts"]["dossier"]["questions"][0]["question_id"] == "q11_decision_owner"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_reruns_question_first_for_question_repair_even_with_existing_answers(monkeypatch):
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "false")

    captured = {"calls": 0}

    async def fake_run_question_first_enrichment(self, *, dossier, entity_id, entity_name, request_metadata):
        captured["calls"] += 1
        payload = dict(dossier)
        payload["question_first"] = {
            "enabled": True,
            "schema_version": "question_first_run_v2",
            "questions_answered": 1,
            "quality_state": "blocked",
            "answers": [{"question_id": "q11_decision_owner", "status": "no_signal"}],
            "categories": [],
        }
        payload["questions"] = [{"question_id": "q11_decision_owner", "status": "no_signal"}]
        return payload

    monkeypatch.setattr(PipelineOrchestrator, "_run_question_first_enrichment", fake_run_question_first_enrichment)

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
        brightdata_client=None,
        claude_client=None,
    )

    await orchestrator.run_entity_pipeline(
        entity_id="fc-porto-2027",
        entity_name="FC Porto",
        entity_type="SPORT_CLUB",
        priority_score=91,
        initial_dossier={
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
            "question_first": {"answers": [{"question_id": "q11_decision_owner", "status": "answered"}]},
            "questions": [{"question_id": "q11_decision_owner", "status": "answered"}],
        },
        request_metadata={
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": True,
        },
    )

    assert captured["calls"] == 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_persists_fresh_canonical_question_repair_payload(monkeypatch):
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "false")

    async def fake_run_question_first_enrichment(self, *, dossier, entity_id, entity_name, request_metadata):
        payload = dict(dossier)
        payload["generated_at"] = "2026-04-10T07:36:45.501Z"
        payload["run_id"] = "legacy-dossier-cache"
        payload["publish_status"] = "staged"
        payload["question_first"] = {
            "enabled": True,
            "schema_version": "question_first_run_v2",
            "questions_answered": 3,
            "quality_state": "blocked",
            "answers": [
                {"question_id": "q7_procurement_signal", "status": "answered"},
                {"question_id": "q11_decision_owner", "status": "no_signal"},
                {"question_id": "q12_connections", "status": "blocked"},
            ],
            "question_timings": {"q11_decision_owner": {"duration_ms": 1200}},
            "categories": [],
        }
        payload["questions"] = [
            {"question_id": "q7_procurement_signal", "status": "answered"},
            {"question_id": "q11_decision_owner", "status": "no_signal"},
            {"question_id": "q12_connections", "status": "blocked"},
        ]
        return payload

    monkeypatch.setattr(PipelineOrchestrator, "_run_question_first_enrichment", fake_run_question_first_enrichment)

    persistence = CapturingPersistenceCoordinator()
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=persistence,
        brightdata_client=None,
        claude_client=None,
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="fc-porto-2027",
        entity_name="FC Porto",
        entity_type="SPORT_CLUB",
        priority_score=91,
        initial_dossier={
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        request_metadata={
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": True,
        },
    )

    persisted_dossier = persistence.run_payloads[-1]["payload"]["dossier"]

    assert persisted_dossier["run_id"] == result["run_id"]
    assert persisted_dossier["publish_status"] == "published"
    assert persisted_dossier["quality_state"] == "blocked"
    assert persisted_dossier["generated_at"] != "2026-04-10T07:36:45.501Z"
    assert persisted_dossier["questions"][1]["question_id"] == "q11_decision_owner"
    assert persisted_dossier["question_first"]["answers"][1]["question_id"] == "q11_decision_owner"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_hard_fails_acceptance_gate_when_dual_write_fails():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinatorFail(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["dual_write_ok"] is False
    assert result["acceptance_gate"]["passed"] is False
    assert "dual_write_incomplete" in result["acceptance_gate"]["reasons"]
    assert result["failure_taxonomy"]["dual_write_incomplete"] == 1
    assert result["failure_taxonomy"]["supabase_write_failure"] >= 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_publishes_degraded_when_only_falkordb_dual_write_fails():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinatorFalkorFail(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="fc-porto-2027",
        entity_name="FC Porto",
        entity_type="CLUB",
        priority_score=90,
    )

    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    assert result["dual_write_ok"] is False
    assert result["acceptance_gate"]["passed"] is True
    assert "dual_write_incomplete" not in result["acceptance_gate"]["reasons"]
    assert result["persistence_status"]["supabase"]["ok"] is True
    assert result["persistence_status"]["falkordb"]["ok"] is False
    assert result["persistence_status"]["reconcile_required"] is True
    assert result["failure_taxonomy"]["dual_write_incomplete"] == 1
    assert result["failure_taxonomy"]["falkordb_write_failure"] >= 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_acceptance_gate_uses_validated_signal_count():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscoveryManySignals(),
        ralph_validator=FakeRalphEmpty(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["validated_signal_count"] == 0
    assert result["acceptance_gate"]["passed"] is False
    assert "signals_below_threshold" in result["acceptance_gate"]["reasons"]
    no_signal_episodes = [
        episode
        for episode in result["artifacts"]["episodes"]
        if isinstance(episode, dict) and str(episode.get("episode_type") or "") == "NO_SIGNAL_FOUND"
    ]
    assert len(no_signal_episodes) == 1


def test_merge_pipeline_run_metadata_persists_self_healing_fields():
    metadata = merge_pipeline_run_metadata(
        {},
        publication_status="published_degraded",
        publication_mode="repair_degraded",
        reconcile_required=True,
        reconciliation_payload={"idempotency_key": "reconcile-me"},
        repair_state="queued",
        repair_retry_count=1,
        repair_retry_budget=3,
        next_repair_question_id="q11_decision_owner",
        reconciliation_state="pending",
    )

    assert metadata["repair_state"] == "queued"
    assert metadata["repair_retry_count"] == 1
    assert metadata["repair_retry_budget"] == 3
    assert metadata["next_repair_question_id"] == "q11_decision_owner"
    assert metadata["reconciliation_state"] == "pending"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_acceptance_gate_supports_hybrid_provisional_mode():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscoveryHybridSignals(),
        ralph_validator=FakeRalphHybrid(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["acceptance_gate"]["passed"] is True
    assert result["acceptance_gate"]["acceptance_mode"] == "hybrid_provisional"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_uses_graphiti_discovery_episode_contract_for_non_rfp_signals():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalphNonRfp(),
        graphiti_service=StrictDiscoveryGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    episodes = result["artifacts"]["episodes"]
    assert len(episodes) == 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_emits_objective_contract_fields():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
        run_objective="rfp_web",
    )

    assert result["objective"] == "rfp_web"
    assert isinstance(result["objective_result"], dict)
    assert isinstance(result["llm_efficiency_metrics"], dict)
    assert "length_stop_count" in result["llm_efficiency_metrics"]
    assert "schema_fail_count" in result["llm_efficiency_metrics"]
