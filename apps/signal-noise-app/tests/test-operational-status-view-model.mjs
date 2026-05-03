import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadOperationalStatusViewModelModule() {
  const sourcePath = new URL("../src/lib/operational-view-model.ts", import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const rewritten = source
    .replaceAll(
      '"@/lib/operational-formatters"',
      JSON.stringify(
        pathToFileURL(
          path.resolve(
            path.dirname(sourcePath.pathname),
            "./operational-formatters.ts",
          ),
        ).href,
      ),
    )
    .replaceAll(
      '"@/lib/operational-drilldown-client"',
      JSON.stringify(
        pathToFileURL(
          path.resolve(
            path.dirname(sourcePath.pathname),
            "./operational-drilldown-client.ts",
          ),
        ).href,
      ),
    )
    .replaceAll(
      '"@/lib/playlist-sort-key"',
      JSON.stringify(
        pathToFileURL(
          path.resolve(path.dirname(sourcePath.pathname), "./playlist-sort-key.ts"),
        ).href,
      ),
    )
    .replaceAll(
      '"@/lib/operational-safety-stop"',
      JSON.stringify(
        pathToFileURL(
          path.resolve(
            path.dirname(sourcePath.pathname),
            "./operational-safety-stop.ts",
          ),
        ).href,
      ),
    );
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "operational-status-vm-"));
  const tempPath = path.join(tempDir, "operational-view-model.ts");
  await writeFile(tempPath, rewritten, "utf8");
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
}

const { buildOperationalStatusViewModel, buildOperationalDrawerViewModel } =
  await loadOperationalStatusViewModelModule();

test("status view model distinguishes requested paused from worker paused", () => {
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: true,
        requested_state: "paused",
        observed_state: "paused",
        transition_state: "paused",
      },
      operational_state: "off",
      loop_status: {
        total_scheduled: 4,
        completed: 0,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 0, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: true,
      requested_state: "paused",
      observed_state: "paused",
      transition_state: "paused",
    },
  });

  assert.equal(vm.isRequestedPaused, true);
  assert.equal(vm.isRequestedRunning, false);
  assert.equal(vm.requestedStateLabel, "Requested paused");
  assert.equal(vm.workerStateLabel, "Paused");
  assert.equal(vm.activityStateLabel, "Paused");
  assert.equal(vm.statusBadgeLabel, "Paused");
  assert.equal(vm.primaryActionLabel, "Start pipeline");
  assert.equal(vm.statusHero.headline, "Pipeline paused…");
  assert.equal(vm.statusHero.primaryActionRecommended, true);
  assert.match(vm.statusHero.supportingLine, /paused until you resume/i);
});

test("status hero treats a paused resumable checkpoint as resumable state, not an issue state", () => {
  const checkpointAt = new Date(Date.now() - 20_000).toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      freshness_state: "fresh",
      last_activity_at: new Date().toISOString(),
      snapshot_at: new Date().toISOString(),
      control: {
        is_paused: true,
        requested_state: "paused",
        observed_state: "paused",
        transition_state: "paused",
        updated_at: new Date().toISOString(),
      },
      operational_state: "paused",
      stop_reason: null,
      runtime: {
        worker: {
          worker_process_state: "running",
          worker_health: "healthy",
        },
      },
      loop_status: {
        total_scheduled: 3332,
        completed: 0,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 0, retryable: 0, resume_needed: 1 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: checkpointAt,
            started_at: checkpointAt,
            current_question_id: "q11_decision_owner",
            current_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            next_repair_question_id: "q11_decision_owner",
            next_repair_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            run_phase: "resume_needed",
          },
        ],
        resume_needed_entities: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: checkpointAt,
            started_at: checkpointAt,
            current_question_id: "q11_decision_owner",
            current_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            next_repair_question_id: "q11_decision_owner",
            next_repair_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            run_phase: "resume_needed",
          },
        ],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: true,
      requested_state: "paused",
      observed_state: "paused",
      transition_state: "paused",
      updated_at: new Date().toISOString(),
    },
  });

  assert.match(vm.statusHero.headline, /Paused/i);
  assert.match(vm.statusHero.headline, /checkpoint|resume/i);
  assert.match(vm.statusHero.supportingLine, /FC Porto/i);
  assert.match(vm.statusHero.supportingLine, /question rerun ready|resum/i);
  assert.equal(vm.statusHero.issueSummary, null);
  assert.equal(vm.statusHero.marqueeLine, vm.statusHero.headline);
  assert.equal(
    vm.statusHero.detailRows.some((row) => row.label === "Current section"),
    false,
  );
  assert.equal(
    vm.statusHero.detailRows.some((row) => row.label === "Execution state"),
    false,
  );
});

test("status hero prefers the resumable paused checkpoint over an unrelated stale latest completion", () => {
  const now = new Date().toISOString();
  const staleCheckpointAt = new Date(Date.now() - 2 * 60 * 60_000 - 35 * 60_000).toISOString();
  const staleLatestAt = new Date(Date.now() - 20_000).toISOString();

  const vm = buildOperationalStatusViewModel({
    drilldown: {
      freshness_state: "stale",
      last_activity_at: staleCheckpointAt,
      snapshot_at: now,
      control: {
        is_paused: true,
        requested_state: "paused",
        observed_state: "paused",
        transition_state: "paused",
        updated_at: now,
      },
      operational_state: "paused",
      stop_reason: null,
      runtime: {
        worker: {
          worker_process_state: "running",
          worker_health: "healthy",
        },
      },
      loop_status: {
        total_scheduled: 3332,
        completed: 1,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 8, retryable: 0, resume_needed: 1 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [
          {
            entity_id: "zamalek-sc-handball",
            entity_name: "Zamalek SC Handball",
            entity_type: "club",
            summary: "Latest paused row.",
            generated_at: staleLatestAt,
            started_at: staleLatestAt,
            run_phase: "entity_registration",
            current_action: "entity_registration",
          },
        ],
        resume_needed_entities: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: staleCheckpointAt,
            started_at: staleCheckpointAt,
            current_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            next_repair_question_id: "q11_decision_owner",
            next_repair_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            run_phase: "resume_needed",
          },
        ],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: true,
      requested_state: "paused",
      observed_state: "paused",
      transition_state: "paused",
      updated_at: now,
    },
  });

  assert.match(vm.statusHero.headline, /Paused/i);
  assert.match(vm.statusHero.headline, /checkpoint|resume/i);
  assert.match(vm.statusHero.supportingLine, /FC Porto/i);
  assert.match(vm.currentQuestionLabel, /highest probability buyer at FC Porto/i);
  assert.match(
    vm.statusHero.detailRows.find((row) => row.label === "Current question")?.value || "",
    /highest probability buyer at FC Porto/i,
  );
  assert.equal(vm.statusHero.issueSummary, null);
  assert.equal(
    vm.statusHero.detailRows.some((row) => row.label === "Current section"),
    false,
  );
  assert.equal(
    vm.statusHero.detailRows.some((row) => row.label === "Execution state"),
    false,
  );
});

test("status hero prefers a real stop reason over resumable paused checkpoint copy", () => {
  const checkpointAt = new Date(Date.now() - 20_000).toISOString();
  const now = new Date().toISOString();

  const vm = buildOperationalStatusViewModel({
    drilldown: {
      freshness_state: "stale",
      last_activity_at: now,
      snapshot_at: now,
      control: {
        is_paused: true,
        requested_state: "paused",
        observed_state: "paused",
        transition_state: "paused",
        pause_reason: "question retry exhausted",
        stop_reason: "question_retry_exhausted",
        updated_at: now,
      },
      operational_state: "paused",
      stop_reason: "question_retry_exhausted",
      stop_details: {
        entity_name: "FC Porto",
        question_id: "q11_decision_owner",
        error_type: "http_404",
        error_message: "HTTP Error 404: Not Found",
        attempts: 2,
      },
      runtime: {
        worker: {
          worker_process_state: "running",
          worker_health: "healthy",
        },
      },
      loop_status: {
        total_scheduled: 3332,
        completed: 0,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 0, retryable: 0, resume_needed: 1 },
      },
      queue: {
        in_progress_entity: {
          entity_id: "fc-porto",
          entity_name: "FC Porto",
          entity_type: "club",
          generated_at: checkpointAt,
          started_at: checkpointAt,
          current_action: "entity_registration",
          run_phase: "entity_registration",
          current_question_id: "q11_decision_owner",
          current_question_text:
            "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
        },
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: checkpointAt,
            started_at: checkpointAt,
            current_question_id: "q11_decision_owner",
            current_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            next_repair_question_id: "q11_decision_owner",
            next_repair_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            run_phase: "resume_needed",
          },
        ],
        resume_needed_entities: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: checkpointAt,
            started_at: checkpointAt,
            current_question_id: "q11_decision_owner",
            current_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            next_repair_question_id: "q11_decision_owner",
            next_repair_question_text:
              "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
            run_phase: "resume_needed",
          },
        ],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: true,
      requested_state: "paused",
      observed_state: "paused",
      transition_state: "paused",
      pause_reason: "question retry exhausted",
      stop_reason: "question_retry_exhausted",
      stop_details: {
        entity_name: "FC Porto",
        question_id: "q11_decision_owner",
        error_type: "http_404",
        error_message: "HTTP Error 404: Not Found",
        attempts: 2,
      },
      updated_at: now,
    },
  });

  assert.doesNotMatch(vm.statusHero.headline, /resumable checkpoint ready/i);
  assert.doesNotMatch(
    vm.statusHero.supportingLine,
    /start pipeline to resume from the saved checkpoint/i,
  );
  assert.match(vm.statusHero.issueSummary || "", /question retry exhausted/i);
  assert.match(vm.statusHero.marqueeLine || "", /question retry exhausted/i);
  assert.equal(vm.statusHero.primaryActionRecommended, false);
  assert.match(vm.statusHero.primaryActionHint || "", /fc porto/i);
  assert.match(vm.statusHero.primaryActionHint || "", /q11_decision_owner/i);
  assert.match(vm.statusHero.primaryActionHint || "", /http 404/i);
  assert.doesNotMatch(vm.statusHero.primaryActionHint || "", /queue.*question rerun/i);
});

test("status view model exposes starting transition separately from activity", () => {
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "starting",
        transition_state: "starting",
      },
      operational_state: "running",
      loop_status: {
        total_scheduled: 4,
        completed: 0,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 0, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [
          {
            entity_id: "stale-club",
            entity_name: "Stale Club",
            entity_type: "club",
            summary: "Heartbeat stalled.",
            generated_at: new Date(Date.now() - 8 * 60_000).toISOString(),
            started_at: new Date(Date.now() - 8 * 60_000).toISOString(),
            heartbeat_at: new Date(Date.now() - 8 * 60_000).toISOString(),
            current_question_id: "q3_owner",
            current_action: "waiting for worker heartbeat",
            run_phase: "running",
          },
        ],
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "starting",
      transition_state: "starting",
    },
  });

  assert.equal(vm.isTransitioning, true);
  assert.equal(vm.requestedStateLabel, "Requested running");
  assert.equal(vm.workerStateLabel, "Starting");
  assert.equal(vm.activityStateLabel, "Starting");
  assert.equal(vm.statusBadgeLabel, "Starting");
  assert.equal(vm.primaryActionLabel, "Starting pipeline…");
  assert.equal(vm.statusHero.headline, "Starting intake…");
  assert.equal(vm.currentQuestionLabel, "Question 3 of 15");
  assert.match(vm.liveEntityTicker, /Starting — waiting for fresh heartbeat/);
});

test("status view model exposes active question and elapsed work for fresh active entities", () => {
  const startedAt = new Date(Date.now() - 95_000).toISOString();
  const heartbeatAt = new Date(Date.now() - 4_000).toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
      operational_state: "running",
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 1, stalled: 0, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: {
          entity_id: "fifa",
          entity_name: "FIFA",
          entity_type: "governing_body",
          summary: "Processing current question.",
          generated_at: startedAt,
          started_at: startedAt,
          heartbeat_at: heartbeatAt,
          current_question_id: "q3_owner",
          active_question_id: "q3_owner",
          current_action: "question enrichment",
          run_phase: "running",
          last_completed_question: "q2_scope",
          next_action: "Advance to q4",
        },
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
    },
  });

  assert.equal(vm.hasActiveWork, true);
  assert.equal(vm.activityStateLabel, "Running");
  assert.equal(vm.currentQuestionLabel, "Question 3 of 15");
  assert.match(vm.currentElapsedLabel, /\d+m \d+s|\d+s|unknown duration/i);
  assert.match(vm.liveEntityTicker, /FIFA/);
});

test("status view model advances elapsed time as wall clock time moves", () => {
  const realNow = Date.now;
  const startedAt = new Date("2026-04-13T10:00:00.000Z").toISOString();

  try {
    Date.now = () => Date.parse("2026-04-13T10:00:01.000Z");
    const earlyVm = buildOperationalStatusViewModel({
      drilldown: {
        control: {
          is_paused: false,
          requested_state: "running",
          observed_state: "running",
          transition_state: "running",
        },
        operational_state: "running",
        loop_status: {
          total_scheduled: 4,
          completed: 0,
          quality_counts: { blocked: 0, partial: 0 },
          runtime_counts: {
            running: 1,
            queued: 0,
            stalled: 0,
            retryable: 0,
            resume_needed: 0,
          },
        },
        queue: {
          in_progress_entity: {
            entity_id: "fifa",
            entity_name: "FIFA",
            entity_type: "governing_body",
            summary: "Processing current question.",
            generated_at: startedAt,
            started_at: startedAt,
            heartbeat_at: startedAt,
            current_question_id: "q3_owner",
            active_question_id: "q3_owner",
            current_action: "question enrichment",
            run_phase: "running",
          },
          running_entities: [],
          stale_active_rows: [],
          completed_entities: [],
          resume_needed_entities: [],
          upcoming_entities: [],
        },
        dossier_quality: {
          incomplete_entities: [],
        },
      },
      controlState: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
    });

    Date.now = () => Date.parse("2026-04-13T10:00:05.000Z");
    const laterVm = buildOperationalStatusViewModel({
      drilldown: {
        control: {
          is_paused: false,
          requested_state: "running",
          observed_state: "running",
          transition_state: "running",
        },
        operational_state: "running",
        loop_status: {
          total_scheduled: 4,
          completed: 0,
          quality_counts: { blocked: 0, partial: 0 },
          runtime_counts: {
            running: 1,
            queued: 0,
            stalled: 0,
            retryable: 0,
            resume_needed: 0,
          },
        },
        queue: {
          in_progress_entity: {
            entity_id: "fifa",
            entity_name: "FIFA",
            entity_type: "governing_body",
            summary: "Processing current question.",
            generated_at: startedAt,
            started_at: startedAt,
            heartbeat_at: startedAt,
            current_question_id: "q3_owner",
            active_question_id: "q3_owner",
            current_action: "question enrichment",
            run_phase: "running",
          },
          running_entities: [],
          stale_active_rows: [],
          completed_entities: [],
          resume_needed_entities: [],
          upcoming_entities: [],
        },
        dossier_quality: {
          incomplete_entities: [],
        },
      },
      controlState: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
    });

    assert.equal(earlyVm.currentElapsedLabel, "1s");
    assert.equal(laterVm.currentElapsedLabel, "5s");
  } finally {
    Date.now = realNow;
  }
});

test("status view model surfaces a stale freshness checkpoint separately from worker state", () => {
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      freshness_state: "stale",
      last_activity_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      snapshot_at: new Date(Date.now() - 2_000).toISOString(),
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
      operational_state: "running",
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        quality_counts: { blocked: 0, partial: 0 },
        runtime_counts: { running: 1, stalled: 0, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: {
          entity_id: "fifa",
          entity_name: "FIFA",
          entity_type: "governing_body",
          summary: "Processing current question.",
          generated_at: new Date(Date.now() - 12 * 60_000).toISOString(),
          started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
          heartbeat_at: new Date(Date.now() - 11 * 60_000).toISOString(),
          current_question_id: "q3_owner",
          active_question_id: "q3_owner",
          current_action: "question enrichment",
          run_phase: "running",
        },
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
    },
  });

  assert.match(vm.statusHero.issueSummary || "", /snapshot/i);
});

test("status view model marks stale-only rows as stale and uses latest completion fallback", () => {
  const staleAt = new Date(Date.now() - 8 * 60_000).toISOString();
  const completedAt = new Date(Date.now() - 2 * 60_000).toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
      operational_state: "stopped",
      stop_reason: "worker_heartbeat_stale",
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 1, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [
          {
            entity_id: "stale-club",
            entity_name: "Stale Club",
            entity_type: "club",
            summary: "Heartbeat stalled.",
            generated_at: staleAt,
            started_at: staleAt,
            heartbeat_at: staleAt,
            current_question_id: "q8_budget",
            current_action: "waiting for worker heartbeat",
            run_phase: "running",
          },
        ],
        completed_entities: [
          {
            entity_id: "latest-finish",
            entity_name: "Latest Finish",
            entity_type: "club",
            summary: "Completed recently.",
            generated_at: completedAt,
            started_at: new Date(Date.now() - 4 * 60_000).toISOString(),
            last_completed_question: "q4_budget",
            current_action: "completed",
            run_phase: "completed",
          },
        ],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
    },
  });

  assert.equal(vm.isStaleOrStopped, true);
  assert.equal(vm.activityStateLabel, "Stale");
  assert.equal(vm.statusBadgeLabel, "Stale");
  assert.equal(vm.currentQuestionLabel, "Question 8 of 15");
  assert.match(vm.liveEntityTicker, /Stale|Stale Club/);
  assert.match(vm.lastCompletedLabel, /Latest Finish|Question 4 of 15/);
});

test("status view model treats stale backlog as waiting when control remains running", () => {
  const staleAt = new Date(Date.now() - 15 * 60_000).toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
      operational_state: "waiting",
      stop_reason: null,
      runtime: {
        worker: {
          worker_process_state: "running",
          worker_health: "healthy",
        },
      },
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 1, retryable: 1, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Heartbeat stalled.",
            generated_at: staleAt,
            started_at: staleAt,
            heartbeat_at: staleAt,
            current_question_id: "q11_decision_owner",
            current_action: "dossier_generation",
            run_phase: "running",
          },
        ],
        latest_noteworthy_entity: {
          entity_id: "tom-bradley",
          entity_name: "Tom Bradley",
          entity_type: "person",
          summary: "Retrying.",
          generated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
          started_at: new Date(Date.now() - 2 * 60_000).toISOString(),
          current_action: "entity_registration",
          run_phase: "retrying",
        },
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
    },
  });

  assert.equal(vm.workerStateLabel, "Running");
  assert.equal(vm.activityStateLabel, "Waiting");
  assert.equal(vm.statusBadgeLabel, "Waiting");
  assert.equal(vm.primaryActionLabel, "Stop pipeline");
  assert.match(vm.liveEntityTicker, /Idle|waiting for claimable work/i);
});

test("status hero does not describe a queued checkpoint as active processing when live state is waiting", () => {
  const now = new Date().toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
        updated_at: now,
      },
      operational_state: "running",
      freshness_state: "fresh",
      last_activity_at: now,
      runtime: {
        worker: {
          worker_process_state: "running",
          worker_health: "healthy",
        },
        current_run: {
          entity_id: "fc-porto",
          entity_name: "FC Porto",
          phase: "entity_registration",
          queue_state: "queued",
          current_question_id: "q11_decision_owner",
          current_question_text:
            "Who is the highest probability buyer at FC Porto given the current commercial and product context?",
          heartbeat_at: now,
        },
        current_live_run: null,
      },
      live_state: {
        operational_state: "waiting",
        worker_process_state: "running",
        current_run: null,
        current_live_run: null,
        in_progress_entity: null,
        running_entities: [],
      },
      loop_status: {
        total_scheduled: 3332,
        completed: 0,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 0, retryable: 0, resume_needed: 0, queued: 1 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [],
        latest_noteworthy_entity: null,
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
      updated_at: now,
    },
  });

  assert.doesNotMatch(vm.statusHero.headline, /Processing FC Porto/i);
  assert.doesNotMatch(vm.statusHero.supportingLine, /Currently processing FC Porto/i);
  assert.match(vm.statusHero.headline, /Waiting/i);
  assert.match(vm.statusHero.supportingLine, /queue is ready|waiting for claimable work/i);
});

test("status view model keeps stale backlog in a stopped state when the worker crashed even if control still says running", () => {
  const staleAt = new Date(Date.now() - 15 * 60_000).toISOString();
  const vm = buildOperationalStatusViewModel({
    drilldown: {
      control: {
        is_paused: false,
        requested_state: "running",
        observed_state: "running",
        transition_state: "running",
      },
      operational_state: "stopped",
      stop_reason: "worker_heartbeat_stale",
      runtime: {
        worker: {
          worker_process_state: "crashed",
          worker_health: "degraded",
        },
      },
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        quality_counts: { blocked: 0 },
        runtime_counts: { running: 0, stalled: 1, retryable: 0, resume_needed: 0 },
      },
      queue: {
        in_progress_entity: null,
        running_entities: [],
        stale_active_rows: [
          {
            entity_id: "fc-porto",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "Heartbeat stalled.",
            generated_at: staleAt,
            started_at: staleAt,
            heartbeat_at: staleAt,
            current_question_id: "q11_decision_owner",
            current_action: "dossier_generation",
            run_phase: "running",
          },
        ],
        latest_noteworthy_entity: null,
        completed_entities: [],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    controlState: {
      is_paused: false,
      requested_state: "running",
      observed_state: "running",
      transition_state: "running",
    },
  });

  assert.equal(vm.workerStateLabel, "Running");
  assert.equal(vm.activityStateLabel, "Stale");
  assert.equal(vm.statusBadgeLabel, "Stale");
  assert.equal(vm.isStaleOrStopped, true);
  assert.equal(vm.primaryActionLabel, "Start pipeline");
  assert.match(vm.liveEntityTicker, /Stale|FC Porto/);
});

test("operational drawer merges stopped, stale, and resume-needed items into a single stopped lane", () => {
  const drawerVm = buildOperationalDrawerViewModel({
    dashboard: {
      control: {
        is_paused: false,
        pause_reason: null,
        updated_at: null,
      },
      loop_status: {
        total_scheduled: 4,
        completed: 1,
        failed: 0,
        retryable_failures: 0,
        quality_counts: { partial: 0, blocked: 0, complete: 0, client_ready: 0 },
        runtime_counts: { running: 1, stalled: 1, retryable: 0, resume_needed: 1, queued: 1 },
      },
      queue: {
        in_progress_entity: {
          entity_id: "running-1",
          entity_name: "Running One",
          entity_type: "club",
          summary: "Running now.",
          generated_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          current_question_id: "q1",
          current_action: "run",
          run_phase: "running",
        },
        running_entities: [],
        stale_active_rows: [
          {
            entity_id: "stale-1",
            entity_name: "Stale One",
            entity_type: "club",
            summary: "Pipeline execution is stale.",
            generated_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            heartbeat_at: new Date().toISOString(),
            current_question_id: "q2",
            current_action: "stale",
            run_phase: "stalled",
          },
        ],
        completed_entities: [],
        resume_needed_entities: [
          {
            entity_id: "resume-1",
            entity_name: "Resume One",
            entity_type: "club",
            summary: "Resume required.",
            generated_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            current_question_id: "q3",
            current_action: "resume",
            run_phase: "resume_needed",
          },
        ],
        upcoming_entities: [
          {
            entity_id: "upcoming-1",
            entity_name: "Upcoming One",
            entity_type: "club",
            summary: "Waiting in the queue.",
            generated_at: null,
            started_at: null,
          },
        ],
        completed_entities: [
          {
            entity_id: "completed-1",
            entity_name: "Completed One",
            entity_type: "club",
            summary: "Completed dossier.",
            generated_at: new Date().toISOString(),
            started_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
            heartbeat_at: new Date().toISOString(),
            current_question_id: "q4",
            current_action: "done",
            run_phase: "completed",
            publication_status: "published",
          },
        ],
      },
      dossier_quality: {
        incomplete_entities: [
          {
            entity_id: "blocked-1",
            browser_entity_id: "blocked-1",
            entity_name: "Blocked One",
            entity_type: "club",
            quality_state: "blocked",
            quality_summary: "Blocked dossier.",
            generated_at: new Date().toISOString(),
            question_count: 1,
            source: "question_first_dossier",
          },
        ],
      },
    },
    activeSection: "running",
  });

  assert.equal(drawerVm.runningItems.length, 1);
  assert.equal(drawerVm.queueItems.length, 1);
  assert.equal(drawerVm.waitingItems.length, 1);
  assert.equal(drawerVm.stoppedItems.length, 3);
  assert.equal(drawerVm.completedItems.length, 1);
});

test("operational drawer labels non-blocking failed history as failed, continuing", () => {
  const drawerVm = buildOperationalDrawerViewModel({
    dashboard: {
      control: {
        is_paused: false,
        pause_reason: null,
        updated_at: null,
      },
      loop_status: {
        total_scheduled: 4,
        completed: 0,
        failed: 1,
        retryable_failures: 0,
        quality_counts: { partial: 0, blocked: 0, complete: 0, client_ready: 0 },
        runtime_counts: { running: 1, stalled: 0, retryable: 0, resume_needed: 0, queued: 1 },
      },
      queue: {
        in_progress_entity: {
          entity_id: "running-1",
          entity_name: "Running One",
          entity_type: "club",
          summary: "Running now.",
          generated_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          current_question_id: "q1",
          current_action: "run",
          run_phase: "running",
        },
        running_entities: [],
        stale_active_rows: [],
        completed_entities: [
          {
            entity_id: "failed-1",
            entity_name: "FC Porto",
            entity_type: "club",
            summary: "HTTP Error 403: Forbidden",
            generated_at: new Date().toISOString(),
            started_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            heartbeat_at: new Date().toISOString(),
            current_question_id: "q11_decision_owner",
            current_action: "entity_registration",
            run_phase: "entity_registration",
            continue_pipeline_on_failure: true,
            stop_reason: null,
          },
        ],
        resume_needed_entities: [],
        upcoming_entities: [],
      },
      dossier_quality: {
        incomplete_entities: [],
      },
    },
    activeSection: "completed",
  });

  assert.equal(drawerVm.completedItems.length, 1);
  assert.equal(drawerVm.completedItems[0]?.badge, "Failed, continuing");
  assert.equal(drawerVm.completedItems[0]?.next_action, "Inspect the failed entity");
  assert.match(drawerVm.completedItems[0]?.detail || "", /403/);
});
