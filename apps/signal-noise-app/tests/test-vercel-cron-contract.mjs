import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const vercelSource = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const dossiersCronPath = new URL('../src/app/api/cron/dossiers/refresh/route.ts', import.meta.url)
const materializeCronPath = new URL('../src/app/api/cron/graphiti/materialize/route.ts', import.meta.url)
const digestCronPath = new URL('../src/app/api/cron/daily-sales-digest/route.ts', import.meta.url)
const wideRfpCronPath = new URL('../src/app/api/cron/rfp-wide-research/route.ts', import.meta.url)

test('vercel cron is configured for dossier refresh, graphiti materialization, daily digest, and wide research', () => {
  assert.match(vercelSource, /"path": "\/api\/cron\/dossiers\/refresh"/)
  assert.match(vercelSource, /"path": "\/api\/cron\/graphiti\/materialize"/)
  assert.match(vercelSource, /"path": "\/api\/cron\/daily-sales-digest"/)
  assert.match(vercelSource, /"path": "\/api\/cron\/rfp-wide-research"/)
})

test('cron routes exist and require the cron secret', () => {
  assert.equal(existsSync(dossiersCronPath), true)
  assert.equal(existsSync(materializeCronPath), true)
  assert.equal(existsSync(digestCronPath), true)
  assert.equal(existsSync(wideRfpCronPath), true)
  assert.match(readFileSync(dossiersCronPath, 'utf8'), /requireCronSecret/)
  assert.match(readFileSync(materializeCronPath, 'utf8'), /requireCronSecret/)
  assert.match(readFileSync(digestCronPath, 'utf8'), /requireCronSecret/)
  assert.match(readFileSync(wideRfpCronPath, 'utf8'), /requireCronSecret/)
  assert.match(readFileSync(wideRfpCronPath, 'utf8'), /readLatestWideRfpResearchArtifact/)
})
