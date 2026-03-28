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
  assert.equal(vm.primaryActionLabel, "Resume pipeline");
  assert.equal(vm.statusHero.headline, "Pipeline paused…");
  assert.equal(vm.statusHero.primaryActionRecommended, true);
  assert.match(vm.statusHero.supportingLine, /paused until you resume/i);
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
  assert.equal(vm.primaryActionLabel, "Pause pipeline");
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
