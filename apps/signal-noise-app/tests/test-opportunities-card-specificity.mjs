import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

test('opportunity cards expose compact BD analyst briefing fields', () => {
  assert.match(clientSource, /Trigger/)
  assert.match(clientSource, /Why it matters/)
  assert.match(clientSource, /Yellow Panther angle/)
  assert.match(clientSource, /Suggested route/)
  assert.match(clientSource, /Next move/)
  assert.match(clientSource, /Outreach opener/)
  assert.match(clientSource, /Check before outreach/)
  assert.match(clientSource, /Open dossier/)
  assert.match(clientSource, /briefingTitle/)
  assert.match(clientSource, /signalStrength/)
  assert.match(clientSource, /outreachOpener/)
  assert.match(clientSource, /formatSpecificSignalTitle/)
  assert.match(clientSource, /formatSignalStrength/)
  assert.doesNotMatch(clientSource, />Why this is an opportunity</)
  assert.doesNotMatch(clientSource, />Yellow Panther fit</)
  assert.doesNotMatch(clientSource, />Suggested action</)
  assert.doesNotMatch(clientSource, />Next steps</)
  assert.doesNotMatch(clientSource, />Approach strategy</)
  assert.doesNotMatch(clientSource, />Success rationale</)
  assert.doesNotMatch(clientSource, />Verification caveat</)
})

test('opportunity cards include Doncaster-style vacancy copy hooks', () => {
  assert.match(clientSource, /Doncaster Rovers/)
  assert.match(clientSource, /Recruitment Analyst vacancy/)
  assert.match(clientSource, /hiringSignalTitlePattern/)
  assert.match(clientSource, /buyer ownership needs checking/)
})
