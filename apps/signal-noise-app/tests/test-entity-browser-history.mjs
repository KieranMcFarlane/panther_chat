import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserPagePath = new URL('../src/app/entity-browser/client-page.tsx', import.meta.url)
const historyNavPath = new URL('../src/components/header/HistoryNav.tsx', import.meta.url)
const appNavigationPath = new URL('../src/components/layout/AppNavigation.tsx', import.meta.url)

const entityBrowserPageSource = readFileSync(entityBrowserPagePath, 'utf8')
const historyNavSource = readFileSync(historyNavPath, 'utf8')
const appNavigationSource = readFileSync(appNavigationPath, 'utf8')

test('app navigation defers auth session consumers on entity browser routes', () => {
  assert.match(appNavigationSource, /const isEntityBrowserRoute = pathname\?\.startsWith\(['"]\/entity-browser['"]\) \?\? false/)
  assert.match(appNavigationSource, /\{authMenu && !isDossierRoute && !isEntityBrowserRoute && \(/)
})

test('entity browser initializes current page from the URL and keeps it in sync', () => {
  assert.match(entityBrowserPageSource, /import \{ useRouter, useSearchParams \} from ["']next\/navigation["']/)
  assert.match(entityBrowserPageSource, /const searchParams = useSearchParams\(\)/)
  assert.match(entityBrowserPageSource, /const router = useRouter\(\)/)
  assert.match(entityBrowserPageSource, /const initialPageFromUrl = Number\.parseInt\(searchParams\.get\(['"]page['"]\) \|\| ['"]1['"], 10\)/)
  assert.match(entityBrowserPageSource, /const \[currentPage, setCurrentPage\] = useState\(initialPageFromUrl\)/)
  assert.match(entityBrowserPageSource, /useEffect\(\(\) => \{\s*const nextPage = Number\.parseInt\(searchParams\.get\(['"]page['"]\) \|\| ['"]1['"], 10\)/)
  assert.match(entityBrowserPageSource, /\}, \[currentPage, searchParams\]\)/)
  assert.match(entityBrowserPageSource, /const lastFetchedRequestKeyRef = useRef<string \| null>\(null\)/)
  assert.match(entityBrowserPageSource, /const buildEntityQueryParams = useCallback\(\(page: number\) => \{/)
  assert.match(entityBrowserPageSource, /const requestKey = buildEntityQueryParams\(currentPage\)\.toString\(\)/)
  assert.match(entityBrowserPageSource, /if \(lastFetchedRequestKeyRef\.current === requestKey\) \{\s*return\s*\}/)
  assert.match(entityBrowserPageSource, /const currentUrl = `\/entity-browser\$\{searchParams\.toString\(\) \? `\?\$\{searchParams\.toString\(\)\}` : ''\}`/)
  assert.match(entityBrowserPageSource, /if \(nextUrl !== currentUrl\) \{\s*router\.push\(nextUrl, \{ scroll: false \}\)/)
  assert.doesNotMatch(entityBrowserPageSource, /router\.replace\(/)
  assert.match(entityBrowserPageSource, /params\.set\(['"]page['"], currentPage\.toString\(\)\)/)
  assert.match(entityBrowserPageSource, /const updateFilters = useCallback\(\(updater: \(prev: typeof filters\) => typeof filters\) => \{/)
  assert.match(entityBrowserPageSource, /setCurrentPage\(1\)/)
  assert.doesNotMatch(entityBrowserPageSource, /useEffect\(\(\) => \{\s*if \(typeof window !== 'undefined'\) \{\s*setCurrentPage\(1\)/)
})

test('entity browser persists the last visited browser URL for dossier back navigation', () => {
  assert.match(entityBrowserPageSource, /sessionStorage\.setItem\(['"]lastEntityBrowserUrl['"], browserUrl\)/)
  assert.match(entityBrowserPageSource, /const syncEntityBrowserHistory = useCallback\(\(browserUrl: string\) => \{/)
  assert.match(entityBrowserPageSource, /sessionStorage\.getItem\(['"]entityBrowserHistoryStack['"]\)/)
  assert.match(entityBrowserPageSource, /sessionStorage\.setItem\(['"]entityBrowserHistoryStack['"], JSON\.stringify\(nextHistoryStack\)\)/)
  assert.match(entityBrowserPageSource, /sessionStorage\.setItem\(['"]entityBrowserHistoryIndex['"], String\(nextHistoryStack\.length - 1\)\)/)
  assert.match(entityBrowserPageSource, /syncEntityBrowserHistory\(browserUrl\)/)
})

test('history nav falls back to the last entity browser page when leaving a dossier', () => {
  assert.match(historyNavSource, /import \{ usePathname, useRouter \} from ["']next\/navigation["']/)
  assert.match(historyNavSource, /const pathname = usePathname\(\)/)
  assert.match(historyNavSource, /const isDossierRoute = pathname\?\.includes\(['"]\/dossier['"]\) \?\? false/)
  assert.match(historyNavSource, /const isEntityBrowserRoute = pathname\?\.startsWith\(['"]\/entity-browser['"]\) \?\? false/)
  assert.match(historyNavSource, /const storedEntityBrowserUrl = sessionStorage\.getItem\(['"]lastEntityBrowserUrl['"]\)/)
  assert.match(historyNavSource, /const fallbackPage = new URLSearchParams\(window\.location\.search\)\.get\(['"]from['"]\) \|\| ['"]1['"]/)
  assert.match(historyNavSource, /router\.push\(storedEntityBrowserUrl \|\| `\/entity-browser\?page=\$\{fallbackPage\}`\)/)
  assert.match(historyNavSource, /const previousBrowserUrl = currentIndex > 0 \? historyStack\[currentIndex - 1\] : null;/)
  assert.match(historyNavSource, /router\.push\(previousBrowserUrl\);/)
  assert.match(historyNavSource, /const nextBrowserUrl = currentIndex >= 0 && currentIndex < historyStack\.length - 1/)
})
