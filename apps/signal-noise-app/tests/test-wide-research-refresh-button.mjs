import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const buttonSource = readFileSync(
  new URL('../src/components/rfp/WideResearchRefreshButton.tsx', import.meta.url),
  'utf8',
)

test('wide research refresh button exposes a target year dropdown and exclusion-aware prompt payload', () => {
  assert.match(buttonSource, /targetYear/i)
  assert.match(buttonSource, /excludeNames/i)
  assert.match(buttonSource, /select/i)
  assert.match(buttonSource, /Run Manus scout now/i)
})

test('wide research refresh button supports manual live or backtest runs across 2024 and future years', () => {
  assert.match(buttonSource, /researchMode/)
  assert.match(buttonSource, /researchDepth/)
  assert.match(buttonSource, /Manual run mode/)
  assert.match(buttonSource, /Live scout/)
  assert.match(buttonSource, /Backtest/)
  assert.match(buttonSource, /Run depth/)
  assert.match(buttonSource, /Safe/)
  assert.match(buttonSource, /Standard/)
  assert.match(buttonSource, /Deep/)
  assert.match(buttonSource, /2024,\s*2025,\s*2026/)
  assert.doesNotMatch(buttonSource, /<option value="2024">/)
  assert.doesNotMatch(buttonSource, /<option value="2025">/)
  assert.doesNotMatch(buttonSource, /<option value="2026">/)
  assert.match(buttonSource, /baseYear \+ 1/)
  assert.match(buttonSource, /researchMode,\n\s+researchDepth,\n\s+maxKnownUrls/)
})

test('wide research refresh button surfaces the exact Manus prompt preview', () => {
  assert.match(buttonSource, /promptPreview/i)
  assert.match(buttonSource, /details/i)
  assert.match(buttonSource, /Prompt preview/i)
  assert.match(buttonSource, /pre/i)
})

test('wide research refresh button shows Manus credit usage without blocking manual runs', () => {
  assert.match(buttonSource, /\/api\/admin\/manus-usage/)
  assert.match(buttonSource, /Manus usage/)
  assert.match(buttonSource, /Today/)
  assert.match(buttonSource, /This month/)
  assert.match(buttonSource, /Manual Pro snapshot/)
  assert.match(buttonSource, /Total credits/)
  assert.match(buttonSource, /Monthly credits/)
  assert.match(buttonSource, /Daily refresh/)
  assert.match(buttonSource, /Latest Manus tasks/)
  assert.match(buttonSource, /Refresh usage/)
  assert.match(buttonSource, /Usage unavailable/)
  assert.match(buttonSource, /Run Manus scout now/)
})
