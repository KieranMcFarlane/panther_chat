import builtins
import sys
from pathlib import Path
from types import SimpleNamespace
from dataclasses import dataclass, field

import pytest
from bs4 import BeautifulSoup

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from brightdata_sdk_client import BrightDataSDKClient
from run_fixed_dossier_pipeline import FixedDossierFirstPipeline

SCRIPT_ROOT = Path(__file__).resolve().parents[2] / "scripts"


@dataclass
class _CompareResult:
    final_confidence: float
    iterations_completed: int
    signals_discovered: list
    performance_summary: dict = field(default_factory=dict)
    provisional_signals: list = field(default_factory=list)
    candidate_evaluations: list = field(default_factory=list)
    actionability_score: float = 0.0
    entity_grounded_signal_count: int = 0
    controller_health_reasons: list = field(default_factory=list)

    def to_dict(self):
        return {
            "final_confidence": self.final_confidence,
            "iterations_completed": self.iterations_completed,
            "signals_discovered": self.signals_discovered,
            "provisional_signals": self.provisional_signals,
            "candidate_evaluations": self.candidate_evaluations,
            "performance_summary": self.performance_summary,
            "actionability_score": self.actionability_score,
            "entity_grounded_signal_count": self.entity_grounded_signal_count,
            "controller_health_reasons": self.controller_health_reasons,
        }


@pytest.mark.asyncio
async def test_phase2_uses_passed_max_iterations():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    captured = {}

    class _Discovery:
        async def run_discovery_with_dossier_context(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(final_confidence=0.7, iterations_completed=1, signals_discovered=[])

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 1}),
        max_iterations=7,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.7
    assert captured["max_iterations"] == 7


@pytest.mark.asyncio
async def test_phase2_handles_discovery_signature_without_template_id():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    captured = {}

    class _Discovery:
        async def run_discovery_with_dossier_context(
            self,
            *,
            entity_id,
            entity_name,
            dossier,
            max_iterations,
            progress_callback=None,
        ):
            captured.update(
                {
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "dossier": dossier,
                    "max_iterations": max_iterations,
                    "progress_callback": progress_callback,
                }
            )
            return SimpleNamespace(final_confidence=0.8, iterations_completed=2, signals_discovered=[])

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 2}),
        max_iterations=9,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.8
    assert captured["max_iterations"] == 9
    assert captured["dossier"]["x"] == 2
    assert isinstance(captured["dossier"].get("metadata"), dict)
    assert captured["dossier"]["metadata"].get("entity_id") == "coventry-city-fc"


@pytest.mark.asyncio
async def test_phase2_two_pass_runs_pass_b_when_pass_a_quality_gate_met():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.two_pass_enabled = True
    pipeline.two_pass_pass_a_only = False
    pipeline.two_pass_pass_a_iterations = 2
    pipeline.two_pass_pass_b_iterations = 4
    pipeline.two_pass_gate_min_confidence = 0.45
    pipeline.two_pass_gate_min_signals = 1
    pipeline.shadow_unbounded_enabled = False

    calls = []

    class _Discovery:
        async def run_discovery_with_dossier_context(self, **kwargs):
            calls.append(kwargs["max_iterations"])
            if kwargs["max_iterations"] <= 2:
                return SimpleNamespace(final_confidence=0.6, iterations_completed=2, signals_discovered=[{"id": "s1"}], performance_summary={})
            return SimpleNamespace(final_confidence=0.75, iterations_completed=4, signals_discovered=[{"id": "s1"}, {"id": "s2"}], performance_summary={})

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 1}),
        max_iterations=6,
        template_id="tier_1_club_centralized_procurement",
    )

    assert calls == [2, 4]
    assert result.final_confidence == 0.75
    assert result.performance_summary.get("two_pass", {}).get("pass_b_executed") is True


@pytest.mark.asyncio
async def test_phase2_two_pass_a_only_returns_pass_a_result():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.two_pass_enabled = True
    pipeline.two_pass_pass_a_only = True
    pipeline.two_pass_pass_a_iterations = 2
    pipeline.two_pass_pass_b_iterations = 4
    pipeline.two_pass_gate_min_confidence = 0.45
    pipeline.two_pass_gate_min_signals = 1
    pipeline.shadow_unbounded_enabled = False

    calls = []

    class _Discovery:
        async def run_discovery_with_dossier_context(self, **kwargs):
            calls.append(kwargs["max_iterations"])
            return SimpleNamespace(final_confidence=0.55, iterations_completed=2, signals_discovered=[{"id": "s1"}], performance_summary={})

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="fiba",
        entity_name="FIBA",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 2}),
        max_iterations=6,
        template_id="federation_governing_body",
    )

    assert calls == [2]
    assert result.final_confidence == 0.55
    assert result.performance_summary.get("two_pass", {}).get("pass_b_executed") is False


@pytest.mark.asyncio
async def test_phase2_dual_compare_survives_single_lane_failure():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.two_pass_enabled = False
    pipeline.shadow_unbounded_enabled = False
    pipeline.discovery_runtime_mode = "dual_compare"
    pipeline._last_shadow_discovery_payload = None
    pipeline._last_dual_compare_payload = None
    pipeline._last_v2_compare_payload = None
    pipeline._last_agentic_compare_payload = None
    pipeline.discovery_engine = "v2"
    pipeline.discovery = SimpleNamespace(
        run_discovery=pytest.fail,
        current_official_site_url=None,
    )
    pipeline.dossier_generator = None
    pipeline.schema_first_result = None

    class _OkRuntime:
        current_official_site_url = None

        async def run_discovery_with_dossier_context(self, **kwargs):
            return _CompareResult(
                final_confidence=0.72,
                iterations_completed=2,
                signals_discovered=[{"validation_state": "validated", "subtype": "procurement_signal", "text": "supplier review"}],
                performance_summary={
                    "planner_decision_applied_rate": 0.8,
                    "off_entity_reject_rate": 0.0,
                    "schema_fail_count": 0,
                    "total_duration_ms": 400.0,
                    "actionability_score": 82.0,
                },
                actionability_score=82.0,
                entity_grounded_signal_count=1,
                controller_health_reasons=["healthy"],
            )

    class _FailRuntime:
        current_official_site_url = None

        async def run_discovery_with_dossier_context(self, **kwargs):
            raise RuntimeError("agentic_lane_failed")

    def _ensure_compare_discovery(name):
        return _OkRuntime() if name == "v2" else _FailRuntime()

    pipeline._ensure_compare_discovery = _ensure_compare_discovery

    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"metadata": {"website": "https://www.ccfc.co.uk"}}),
        max_iterations=4,
        template_id=None,
    )

    assert result.final_confidence == 0.72
    assert pipeline._last_dual_compare_payload["status"] == "partial_lane_failure"
    assert pipeline._last_dual_compare_payload["winner_runtime"] == "v2"


def test_extract_publication_date_handles_missing_dateutil(monkeypatch):
    client = BrightDataSDKClient(token="test-token")
    soup = BeautifulSoup("<html><head></head><body><h1>No date</h1></body></html>", "html.parser")

    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "dateutil" or name.startswith("dateutil."):
            raise ImportError("dateutil unavailable")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    # Should not raise even when python-dateutil is unavailable.
    dt = client._extract_publication_date(
        soup=soup,
        html_content=str(soup),
        url="https://example.com/news/2025/01/15/test-story",
    )
    assert dt is not None
    assert dt.year == 2025
    assert dt.month == 1
    assert dt.day == 15


def test_runtime_import_guard_reports_expected_shape():
    payload = FixedDossierFirstPipeline._validate_runtime_imports()
    assert payload["status"] in {"ok", "failed"}
    assert "checked" in payload
    assert "missing" in payload
    if payload["status"] == "failed":
        assert payload["failure_class"] == "import_context_failure"


def test_write_run_report_includes_failure_taxonomy(tmp_path):
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.run_reports_dir = tmp_path
    pipeline._runtime_import_guard = {
        "status": "failed",
        "missing": ["template_loader"],
        "failure_class": "import_context_failure",
    }
    pipeline._last_discovery_error_class = "import_context_failure"
    pipeline._last_discovery_error_message = "No module named 'template_loader'"

    report = pipeline._write_run_report(
        entity_id="fiba",
        entity_name="FIBA",
        dossier={"sections": []},
        discovery={
            "final_confidence": 0.5,
            "iterations_completed": 0,
            "signals_discovered": [],
            "parse_path": "schema_gate_low_signal",
            "llm_last_status": "empty_response_deterministic_fallback",
            "performance_summary": {
                "hop_timings": [
                    {"evidence_type": "entity_grounding_filter"},
                    {"evidence_type": "other"},
                ]
            },
        },
        scores={"procurement_maturity": 0.0, "sales_readiness": "MONITOR", "active_probability": 0.0},
        phase_timings={},
        artifacts={},
        total_time_seconds=1.2,
        phases={},
    )

    taxonomy = report["metrics"]["failure_taxonomy"]
    assert taxonomy["import_context_failure"] == 1
    assert taxonomy["llm_empty_response"] == 1
    assert taxonomy["schema_gate_fallback"] == 1
    assert taxonomy["low_signal_content"] == 1
    assert taxonomy["entity_grounding_reject"] == 1


def test_write_run_report_surfaces_discovery_controller_summary(tmp_path):
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.run_reports_dir = tmp_path
    pipeline._runtime_import_guard = {"status": "ok", "missing": [], "failure_class": None}
    pipeline._last_discovery_error_class = None
    pipeline._last_discovery_error_message = None

    report = pipeline._write_run_report(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"sections": []},
        discovery={
            "final_confidence": 0.62,
            "iterations_completed": 4,
            "signals_discovered": [{"validation_state": "validated", "evidence_found": "validated evidence"}],
            "provisional_signals": [
                {"validation_state": "provisional"},
                {"validation_state": "provisional"},
            ],
            "candidate_evaluations": [{}, {}],
            "performance_summary": {
                "hop_budget_initial": 5,
                "hop_budget_final": 15,
                "hop_credits_earned": 10,
                "hop_credit_events": 2,
                "dynamic_hop_credits_enabled": True,
                "llm_hop_selection_count": 3,
                "planner_action_applied_count": 2,
                "planner_action_parse_fail_count": 1,
                "hop_timings": [
                    {"planner_action": {"action": "search_queries"}, "planner_search_queries": ['"Coventry City FC" official commercial partner']},
                    {"planner_action": {"action": "same_domain_probe"}},
                    {"planner_action": {"action": "scrape_candidate"}},
                ],
            },
        },
        scores={"procurement_maturity": 54.3, "sales_readiness": "MONITOR", "active_probability": 0.42},
        phase_timings={},
        artifacts={},
        total_time_seconds=12.3,
        phases={},
    )

    controller = report["metrics"]["discovery_controller"]
    assert controller["hop_budget_initial"] == 5
    assert controller["hop_budget_final"] == 15
    assert controller["hop_credits_earned"] == 10
    assert controller["hop_credit_events"] == 2
    assert controller["dynamic_hop_credits_enabled"] is True
    assert controller["llm_hop_selection_count"] == 3
    assert controller["planner_action_applied_count"] == 2
    assert controller["planner_action_parse_fail_count"] == 1
    assert controller["controller_health"] == "degraded_parse_failures"
    assert controller["planner_search_refinement_count"] == 1
    assert controller["planner_action_counts"]["search_queries"] == 1
    assert controller["planner_action_counts"]["same_domain_probe"] == 1
    assert controller["planner_action_counts"]["scrape_candidate"] == 1
    assert report["signals_validated_count"] == 1
    assert report["signals_provisional_count"] == 2
    assert report["signals_candidate_events_count"] == 2
    assert report["acceptance_mode"] == "hybrid_provisional"
    assert report["acceptance_gate"]["passed"] is True


def test_discovery_controller_ab_script_varies_planner_only():
    script_path = SCRIPT_ROOT / "run-discovery-controller-ab.sh"
    script_text = script_path.read_text()

    assert "CHUTES_MODEL_PLANNER=\"$model\"" in script_text
    assert "CHUTES_MODEL_JUDGE=\"${CHUTES_MODEL_JUDGE" in script_text
    assert "CHUTES_MODEL_FALLBACK=\"${CHUTES_MODEL_FALLBACK" in script_text
    assert "bash scripts/run-pipeline-regression-batch.sh" in script_text
    assert "model_ab_summary" in script_text


def test_count_section_fallbacks_uses_section_reason_and_status():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    counters = pipeline._count_section_fallbacks(
        {
            "sections": [
                {
                    "id": "core_information",
                    "content": ["Structured summary"],
                    "confidence": 0.8,
                    "output_status": "completed",
                    "reason_code": None,
                    "fallback_used": False,
                },
                {
                    "id": "leadership",
                    "content": ["Section generation for leadership returned no structured content in this run."],
                    "confidence": 0.2,
                    "output_status": "completed_with_fallback",
                    "reason_code": "section_json_repair_failed_minimal_placeholder",
                    "fallback_used": True,
                },
            ]
        }
    )

    assert counters["hard_fallback_sections"] == 1
    assert counters["low_confidence_sections"] == 1
    assert counters["empty_sections"] == 0
