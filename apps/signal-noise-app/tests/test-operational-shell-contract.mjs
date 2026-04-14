import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as lucide from "lucide-react";
const appNavigationSource = await readFile(
  new URL("../src/components/layout/AppNavigation.tsx", import.meta.url),
  "utf8",
);
test("operational shell primitives expose the expected visible shell content", async () => {
  const stripSource = await readFile(
    new URL(
      "../src/components/layout/OperationalStatusStrip.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const drawerSource = await readFile(
    new URL("../src/components/layout/OperationalDrawer.tsx", import.meta.url),
    "utf8",
  );
  const routeSource = await readFile(
    new URL("../src/app/api/home/queue-drilldown/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(stripSource, /Live Ops/);
  assert.match(stripSource, /Show run details|Hide run details/);
  assert.match(stripSource, /Entities active/);
  assert.match(stripSource, /getCachedOperationalDrilldownPayload/);
  assert.match(stripSource, /refreshOperationalDrilldownPayload/);
  assert.match(stripSource, /\/api\/home\/pipeline-control/);
  assert.match(stripSource, /setInterval|setTimeout/);
  assert.match(
    stripSource,
    /Resume pipeline|Pause pipeline|Resume pipeline and rerun target/,
  );
  assert.match(stripSource, /SkipForward|PauseCircle|PlayCircle/);
  assert.match(
    stripSource,
    /Off|Paused|Starting|Stopping|Stopped|Waiting|Running|Retrying|Skipping|Repairing/,
  );
  assert.match(stripSource, /Idle — waiting for claimable work/);
  assert.match(stripSource, /stop_reason|stop_details/);
  assert.doesNotMatch(stripSource, /Transport/);
  assert.match(stripSource, /heartbeat .* ago/i);
  assert.doesNotMatch(stripSource, /Pipeline Active/);
  assert.match(stripSource, /Session: /);
  assert.match(stripSource, /setInterval\(\(\) => \{\s*setHeartbeatTick/);
  assert.match(stripSource, /Current session|Latest session/);
  assert.match(stripSource, /Requested|Worker|Activity|Current question|Elapsed|Last completed/);
  assert.doesNotMatch(stripSource, /loadOperationalDrilldownPayload/);
  assert.doesNotMatch(stripSource, /primeOperationalDrilldownPayload/);
  assert.match(drawerSource, /Operational Snapshot/);
  assert.match(drawerSource, /Queue/);
  assert.match(drawerSource, /Running entities/);
  assert.match(drawerSource, /Stale \/ blocked/);
  assert.match(drawerSource, /Completed/);
  assert.doesNotMatch(drawerSource, /Active universe/);
  assert.match(drawerSource, /Queue order/);
  assert.match(drawerSource, /waiting for claimable work/i);
  assert.match(drawerSource, /overflow-y-auto/);
  assert.match(drawerSource, /max-h-\[calc\(100vh-14rem\)\]/);
  assert.match(drawerSource, /loadOperationalDrilldownPayload/);
  assert.match(drawerSource, /operational-drilldown-client/);
  assert.doesNotMatch(drawerSource, /Promise\.all\(\[/);
  assert.match(drawerSource, /Open dossier/);
  assert.doesNotMatch(
    drawerSource,
    /Scanning fresh RFP sources|Smoke journey loaded successfully/,
  );
  assert.match(appNavigationSource, /open-operational-kanban/);
  assert.match(routeSource, /running_entities/);
  assert.match(routeSource, /stale_active_rows/);
  assert.match(routeSource, /hasStaleOnlyActiveRows/);
  assert.match(routeSource, /active_question_id/);
  assert.match(routeSource, /run_phase/);
  assert.match(routeSource, /queue_position/);
  assert.match(routeSource, /heartbeat_at/);
  assert.match(routeSource, /getCanonicalEntitiesSnapshot/);
  assert.match(routeSource, /resolveCanonicalQueueEntity/);
  assert.match(routeSource, /canonical_entity_id/);
  assert.match(routeSource, /source_entity_id/);
  assert.match(routeSource, /lifecycle_stage/);
  assert.match(routeSource, /movement_state/);
  assert.match(routeSource, /next_repair_question_id/);
  assert.match(routeSource, /next_action/);
  assert.match(routeSource, /control/);
});

test("app navigation renders the shared operational shell primitives", async () => {
  const source = await readFile(
    new URL("../src/components/layout/AppNavigation.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /OperationalStatusStrip/);
  assert.match(source, /OperationalDrawer/);
  assert.match(source, /<OperationalStatusStrip/);
  assert.match(source, /<OperationalDrawer/);
  assert.match(source, /activeOpsSection/);
});

test("operational view-model imports the shared playlist sort key formatter", async () => {
  const source = await readFile(
    new URL("../src/lib/operational-view-model.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /formatPlaylistSortKey/);
  assert.match(source, /from "@\/lib\/playlist-sort-key"/);
});

test("operational drawer only uses lucide icons that exist in the installed package", async () => {
  const source = await readFile(
    new URL("../src/components/layout/OperationalDrawer.tsx", import.meta.url),
    "utf8",
  );
  const importMatch = source.match(/import \{([^}]+)\} from 'lucide-react'/);

  assert.ok(importMatch, "expected lucide-react import in operational drawer");

  const importedNames = importMatch[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  for (const iconName of importedNames) {
    assert.equal(
      typeof lucide[iconName],
      "object",
      `expected lucide-react export ${iconName} to exist for OperationalDrawer`,
    );
  }
});
