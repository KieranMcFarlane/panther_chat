import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBadgePath = new URL('../src/components/badge/EntityBadge.tsx', import.meta.url)
const badgeManagerPath = new URL('../src/services/badge-manager.ts', import.meta.url)
const badgeManagementPagePath = new URL('../src/app/badge-management/page.tsx', import.meta.url)
const badgeManagementDashboardPath = new URL('../src/components/badge/BadgeManagementDashboard.tsx', import.meta.url)

const entityBadgeSource = readFileSync(entityBadgePath, 'utf8')
const badgeManagerSource = readFileSync(badgeManagerPath, 'utf8')
const badgeManagementPageSource = readFileSync(badgeManagementPagePath, 'utf8')
const badgeManagementDashboardSource = readFileSync(badgeManagementDashboardPath, 'utf8')

test('badge management page imports a real EntityBadgeGrid export', () => {
  assert.match(badgeManagementPageSource, /EntityBadgeGrid/)
  assert.match(entityBadgeSource, /export function EntityBadgeGrid/)
})

test('badge manager guards localStorage access on the server', () => {
  assert.match(badgeManagerSource, /typeof localStorage === ['"]undefined['"]/)
})

test('badge management dashboard imports EntityBadgeGrid before using it', () => {
  assert.match(badgeManagementDashboardSource, /import\s+\{\s*EntityBadgeGrid\s*\}\s+from\s+['"]@\/components\/badge\/EntityBadge['"]/)
})
