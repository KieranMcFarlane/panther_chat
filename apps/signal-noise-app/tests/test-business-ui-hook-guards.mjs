import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const appNavigationSource = readFileSync(
  new URL('../src/components/layout/AppNavigation.tsx', import.meta.url),
  'utf8'
)

const enhancedPersonDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/EnhancedPersonDossier.tsx', import.meta.url),
  'utf8'
)

test('app navigation uses component-based nav item rendering for hooks safety', () => {
  assert.match(appNavigationSource, /const NavItem = \(\{ item \}/)
  assert.match(appNavigationSource, /<NavItem item=\{item\} \/>/)
  assert.doesNotMatch(appNavigationSource, /const renderNavItem = \(/)
  assert.doesNotMatch(appNavigationSource, /\{renderNavItem\(item\)\}/)
})

test('enhanced person dossier imports map pin icon used in rendered JSX', () => {
  assert.match(enhancedPersonDossierSource, /MapPin/)
  assert.match(enhancedPersonDossierSource, /<MapPin className="h-4 w-4" \/>/)
})
