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
const viewTransitionSource = readFileSync(
  new URL('../src/lib/view-transition.ts', import.meta.url),
  'utf8',
)
const leagueDossiersListSource = readFileSync(
  new URL('../src/app/dossiers/leagues/page.tsx', import.meta.url),
  'utf8',
)
const leagueDossierSource = readFileSync(
  new URL('../src/app/dossiers/leagues/[leagueSlug]/client-page.tsx', import.meta.url),
  'utf8',
)
const rfpEntityBrowserSource = readFileSync(
  new URL('../src/app/rfp-intelligence/entity-browser.tsx', import.meta.url),
  'utf8',
)
const rfpIntelligencePageSource = readFileSync(
  new URL('../src/app/rfp-intelligence/page.tsx', import.meta.url),
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

test('entity profile and dossier pages use content-level fade transitions', () => {
  assert.match(entityPageSource, /isContentTransitioning/)
  assert.match(entityPageSource, /transition-opacity duration-200/)
  assert.match(entityPageSource, /viewTransitionName: "dossier-content"/)
  assert.match(dossierPageSource, /isContentTransitioning/)
  assert.match(dossierPageSource, /transition-opacity duration-200/)
  assert.match(dossierPageSource, /viewTransitionName: "dossier-content"/)
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

test('navigation uses View Transitions API helper when available', () => {
  assert.match(viewTransitionSource, /startViewTransition/)
  assert.match(entityCardSource, /pushWithViewTransition/)
  assert.match(entityPageSource, /pushWithViewTransition/)
  assert.match(dossierPageSource, /pushWithViewTransition/)
})

test('league dossiers list uses view-transition navigation helper instead of hard reloads', () => {
  assert.match(leagueDossiersListSource, /pushWithViewTransition/)
  assert.doesNotMatch(leagueDossiersListSource, /window\.location\.href\s*=\s*['"`]\/entity-browser['"`]/)
  assert.doesNotMatch(leagueDossiersListSource, /window\.location\.href\s*=\s*`\/dossiers\/leagues\/\$\{dossier\.name\}`/)
})

test('league dossier page uses content-level fade transitions and view-transition navigation', () => {
  assert.match(leagueDossierSource, /pushWithViewTransition/)
  assert.match(leagueDossierSource, /isContentTransitioning/)
  assert.match(leagueDossierSource, /transition-opacity duration-200/)
  assert.match(leagueDossierSource, /viewTransitionName: "dossier-content"/)
})

test('rfp entity browser uses view-transition navigation back to dashboard', () => {
  assert.match(rfpEntityBrowserSource, /pushWithViewTransition/)
  assert.doesNotMatch(rfpEntityBrowserSource, /window\.location\.href\s*=\s*['"`]\/rfp-intelligence['"`]/)
})

test('rfp intelligence page syncs tab state with History API', () => {
  assert.match(rfpIntelligencePageSource, /window\.history\.(replaceState|pushState)/)
  assert.match(rfpIntelligencePageSource, /window\.addEventListener\('popstate'/)
})

test('rfp intelligence page uses content-level fade transitions for tab switches', () => {
  assert.match(rfpIntelligencePageSource, /isContentTransitioning/)
  assert.match(rfpIntelligencePageSource, /transition-opacity duration-200/)
  assert.match(rfpIntelligencePageSource, /viewTransitionName: "dossier-content"/)
})
