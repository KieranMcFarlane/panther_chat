import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityCardPath = new URL('../src/components/EntityCard.tsx', import.meta.url)
const source = readFileSync(entityCardPath, 'utf8')

test('entity card prefetches the dossier route on hover intent', () => {
  assert.match(source, /const prefetchDossierRoute = \(\) => \{/)
  assert.match(source, /const href = getEntityBrowserDossierHref\(entity, currentPage\)/)
  assert.match(source, /router\.prefetch\(href\)/)
  assert.match(source, /onMouseEnter=\{prefetchDossierRoute\}/)
  assert.match(source, /onFocus=\{prefetchDossierRoute\}/)
  assert.match(source, /onTouchStart=\{prefetchDossierRoute\}/)
})

test('entity card only prefetches the dossier route once per rendered card', () => {
  assert.match(source, /const hasPrefetchedDossierRouteRef = useRef\(false\)/)
  assert.match(source, /if \(hasPrefetchedDossierRouteRef\.current\) return/)
  assert.match(source, /hasPrefetchedDossierRouteRef\.current = true/)
})

test('entity card no longer prefetches entity JSON on mount for every card', () => {
  assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*const prefetchId = getEntityPrefetchId\(entity\)/)
  assert.doesNotMatch(source, /prefetchEntity\(/)
})

test('entity card shows a loading spinner while profile navigation is in flight', () => {
  assert.match(source, /const \[isProfileLoading, setIsProfileLoading\] = useState\(false\)/)
  assert.match(source, /if \(isProfileLoading\) return/)
  assert.match(source, /setIsProfileLoading\(true\)/)
  assert.match(source, /disabled=\{isProfileLoading\}/)
  assert.match(source, /<Loader2 className="h-4 w-4 mr-2 animate-spin" \/>/)
  assert.match(source, /Loading Profile\.\.\./)
})
