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
  assert.match(buttonSource, /Trigger Manus \+ normalize/i)
})

test('wide research refresh button surfaces the exact Manus prompt preview', () => {
  assert.match(buttonSource, /promptPreview/i)
  assert.match(buttonSource, /details/i)
  assert.match(buttonSource, /Prompt preview/i)
  assert.match(buttonSource, /pre/i)
})
