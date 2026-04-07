import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notificationsSource = readFileSync(new URL('../src/components/header/Notifications.tsx', import.meta.url), 'utf8')

test('header notifications consume graphiti notification records instead of static mock items', () => {
  assert.match(notificationsSource, /\/api\/notifications\/graphiti/)
  assert.doesNotMatch(notificationsSource, /New transfer rumor/)
  assert.match(notificationsSource, /destination_url/)
  assert.match(notificationsSource, /short_message/)
})
