import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as lucide from 'lucide-react'
test('operational shell primitives expose the expected visible shell content', async () => {
  const stripSource = await readFile(new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url), 'utf8')
  const drawerSource = await readFile(new URL('../src/components/layout/OperationalDrawer.tsx', import.meta.url), 'utf8')
  const routeSource = await readFile(new URL('../src/app/api/home/queue-drilldown/route.ts', import.meta.url), 'utf8')

  assert.match(stripSource, /Live Ops/)
  assert.match(stripSource, /Show run details|Hide run details/)
  assert.match(stripSource, /Entities active/)
  assert.match(stripSource, /Queue entity/)
  assert.match(stripSource, /Queue next batch/)
  assert.match(stripSource, /loadOperationalDrilldownPayload|getCachedOperationalDrilldownPayload/)
  assert.match(stripSource, /refreshOperationalDrilldownPayload/)
  assert.match(stripSource, /primeOperationalDrilldownPayload/)
  assert.match(stripSource, /\/api\/home\/pipeline-control/)
  assert.match(stripSource, /Start pipeline|Stop intake/)
  assert.match(stripSource, /aria-label="Queue entity"/)
  assert.match(stripSource, /aria-label="Queue next batch"|title="Queue next batch"/)
  assert.match(stripSource, /SkipForward|PauseCircle|PlayCircle/)
  assert.match(stripSource, /Now playing|Waiting|Repairing|Paused/)
  assert.match(stripSource, /Waiting for claimable work/)
  assert.match(stripSource, /requested|acknowledged|running|paused/i)
  assert.match(drawerSource, /Operational Snapshot/)
  assert.match(drawerSource, /Running entities/)
  assert.match(drawerSource, /Blocked dossiers/)
  assert.match(drawerSource, /Recent completions/)
  assert.match(drawerSource, /Active universe/)
  assert.match(drawerSource, /Current question/)
  assert.match(drawerSource, /Run phase/)
  assert.match(drawerSource, /Queue order/)
  assert.match(drawerSource, /Current entity/)
  assert.match(drawerSource, /Next action/)
  assert.match(drawerSource, /Current stage/)
  assert.match(drawerSource, /Open next repair batch/)
  assert.match(drawerSource, /Queue entity/)
  assert.match(drawerSource, /Queue next batch/)
  assert.match(drawerSource, /Movement state|Moving|Review needed/)
  assert.match(drawerSource, /waiting for claimable work/i)
  assert.match(drawerSource, /overflow-y-auto/)
  assert.match(drawerSource, /max-h-\[calc\(100vh-14rem\)\]/)
  assert.match(drawerSource, /loadOperationalDrilldownPayload/)
  assert.match(drawerSource, /refreshOperationalDrilldownPayload/)
  assert.match(drawerSource, /operational-drilldown-client/)
  assert.doesNotMatch(drawerSource, /Promise\.all\(\[/)
  assert.match(drawerSource, /Open dossier/)
  assert.doesNotMatch(drawerSource, /Scanning fresh RFP sources|Smoke journey loaded successfully/)
  assert.match(routeSource, /running_entities/)
  assert.match(routeSource, /active_question_id/)
  assert.match(routeSource, /run_phase/)
  assert.match(routeSource, /queue_position/)
  assert.match(routeSource, /getCanonicalEntitiesSnapshot/)
  assert.match(routeSource, /resolveCanonicalQueueEntity/)
  assert.match(routeSource, /canonical_entity_id/)
  assert.match(routeSource, /source_entity_id/)
  assert.match(routeSource, /lifecycle_stage/)
  assert.match(routeSource, /movement_state/)
  assert.match(routeSource, /next_repair_question_id/)
  assert.match(routeSource, /next_action/)
  assert.match(routeSource, /control/)
})

test('app navigation renders the shared operational shell primitives', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')

  assert.match(source, /OperationalStatusStrip/)
  assert.match(source, /OperationalDrawer/)
  assert.match(source, /<OperationalStatusStrip/)
  assert.match(source, /<OperationalDrawer/)
  assert.match(source, /activeOpsSection/)
})

test('operational drawer only uses lucide icons that exist in the installed package', async () => {
  const source = await readFile(new URL('../src/components/layout/OperationalDrawer.tsx', import.meta.url), 'utf8')
  const importMatch = source.match(/import \{([^}]+)\} from 'lucide-react'/)

  assert.ok(importMatch, 'expected lucide-react import in operational drawer')

  const importedNames = importMatch[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  for (const iconName of importedNames) {
    assert.equal(
      typeof lucide[iconName],
      'object',
      `expected lucide-react export ${iconName} to exist for OperationalDrawer`,
    )
  }
})
