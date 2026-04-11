import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders page embeds a scout panel beside the live intake feed', async () => {
  const pageSource = await readFile(new URL('../src/app/tenders/page.tsx', import.meta.url), 'utf8')
  const scoutPanelSource = await readFile(new URL('../src/components/rfp/ScoutPanel.tsx', import.meta.url), 'utf8')

  assert.match(pageSource, /Live Intake Feed/)
  assert.match(pageSource, /ScoutPanel/)
  assert.match(pageSource, /onRunScout=\{startA2A\}/)
  assert.match(pageSource, /getDefaultWideRfpSeedQuery/)
  assert.doesNotMatch(pageSource, /rfp-wide-research\.mjs/)
  assert.match(pageSource, /statusLabel=\{a2aRunning \? 'Running' : 'Ready'\}/)
  assert.match(scoutPanelSource, /Run scout/)
  assert.match(scoutPanelSource, /Advanced scout/)
  assert.match(scoutPanelSource, /Focus area/)
  assert.match(scoutPanelSource, /aria-label="Focus area"/)
  assert.match(scoutPanelSource, /web-platforms/)
  assert.match(scoutPanelSource, /fan-engagement/)
  assert.match(scoutPanelSource, /crm/)
  assert.match(scoutPanelSource, /onRunScout: \(focusArea: string\) => void/)
})
