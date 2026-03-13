import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserSource = readFileSync(
  new URL('../src/app/entity-browser/client-page.tsx', import.meta.url),
  'utf8',
)
const entityCardSource = readFileSync(
  new URL('../src/components/EntityCard.tsx', import.meta.url),
  'utf8',
)
const entityPageSource = readFileSync(
  new URL('../src/app/entity/[entityId]/client-page.tsx', import.meta.url),
  'utf8',
)
const dossierPageSource = readFileSync(
  new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url),
  'utf8',
)
const enhancedClubDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/EnhancedClubDossier.tsx', import.meta.url),
  'utf8',
)

test('entity browser uses history API for pagination URL sync', () => {
  assert.match(entityBrowserSource, /window\.history\.pushState/)
  assert.match(entityBrowserSource, /window\.addEventListener\('popstate'/)
})

test('entity card stores return URL before dossier/entity navigation', () => {
  assert.match(entityCardSource, /rememberEntityBrowserUrl/)
})

test('entity profile and dossier page resolve entity-browser return URL from shared helper', () => {
  assert.match(entityPageSource, /resolveEntityBrowserReturnUrl/)
  assert.match(dossierPageSource, /resolveEntityBrowserReturnUrl/)
})

test('entity profile lazy loads heavy dossier and email modules', () => {
  assert.match(entityPageSource, /dynamic\(\(\) => import\("@\/components\/entity-dossier"\)/)
  assert.match(entityPageSource, /dynamic\(\(\) => import\("@\/components\/email\/EmailComposeModal"\)/)
})

test('entity card prefetches dossier/profile routes for faster transitions', () => {
  assert.match(entityCardSource, /router\.prefetch\(`\/entity\/\$\{stableEntityId\}`\)/)
  assert.match(entityCardSource, /router\.prefetch\(`\/entity-browser\/\$\{stableEntityId\}\/dossier`\)/)
})

test('entity browser progressively renders list window to reduce first paint cost', () => {
  assert.match(entityBrowserSource, /const \[visibleCount, setVisibleCount\] = useState/)
  assert.match(entityBrowserSource, /entities\.slice\(0, visibleCount\)/)
})

test('entity browser uses viewport observer to defer card mounting off-screen', () => {
  assert.match(entityBrowserSource, /new IntersectionObserver/)
  assert.match(entityBrowserSource, /isVisible/)
})

test('enhanced dossier tabs lazy-load heavy tab panels', () => {
  assert.match(enhancedClubDossierSource, /dynamic\(\(\) => import\("\.\/OutreachStrategyPanel"\)/)
  assert.match(enhancedClubDossierSource, /dynamic\(\(\) => import\("\.\/HypothesisStatesPanel"\)/)
})

test('entity browser uses react-window virtualization for rendered cards', () => {
  assert.match(entityBrowserSource, /from "react-window"/)
  assert.match(entityBrowserSource, /FixedSizeList/)
})
