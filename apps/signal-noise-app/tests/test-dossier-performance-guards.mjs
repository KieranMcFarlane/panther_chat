import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leagueNavPath = new URL('../src/components/header/LeagueNavSimple.tsx', import.meta.url)
const enhancedDossierPath = new URL('../src/components/entity-dossier/EnhancedClubDossier.tsx', import.meta.url)
const outreachPath = new URL('../src/components/entity-dossier/OutreachStrategyPanel.tsx', import.meta.url)
const hypothesisHookPath = new URL('../src/hooks/useHypothesisStates.ts', import.meta.url)
const appNavigationPath = new URL('../src/components/layout/AppNavigation.tsx', import.meta.url)
const appShellPath = new URL('../src/components/layout/AppShell.tsx', import.meta.url)
const entityClientPagePath = new URL('../src/app/entity/[entityId]/client-page.tsx', import.meta.url)

const leagueNavSource = readFileSync(leagueNavPath, 'utf8')
const enhancedDossierSource = readFileSync(enhancedDossierPath, 'utf8')
const outreachSource = readFileSync(outreachPath, 'utf8')
const hypothesisHookSource = readFileSync(hypothesisHookPath, 'utf8')
const appNavigationSource = readFileSync(appNavigationPath, 'utf8')
const appShellSource = readFileSync(appShellPath, 'utf8')
const entityClientPageSource = readFileSync(entityClientPagePath, 'utf8')

test('dossier header defers entity summary loading until needed', () => {
  assert.match(leagueNavSource, /currentEntity\?: any \| null/)
  assert.match(leagueNavSource, /const fetchedCurrentEntityData = useEntity\(currentEntity \? null : entityId\)\.entity/)
  assert.match(leagueNavSource, /import \{ formatValue \} from ['"]@\/lib\/formatValue['"]/)
  assert.match(leagueNavSource, /usePathname/)
  assert.match(leagueNavSource, /const shouldLoadSummaries = !isDossierRoute \|\| isModalOpen/)
  assert.match(leagueNavSource, /useEntitySummaries\(shouldLoadSummaries \? ['"]\/api\/entities\/summary['"] : null\)/)
  assert.match(leagueNavSource, /function getMeaningfulValue\(value: unknown\): string/)
  assert.match(leagueNavSource, /unknown\|null\|none/)
  assert.match(leagueNavSource, /function getEntityGroupInfo\(entity: Club\)/)
  assert.match(leagueNavSource, /const leagueName = getMeaningfulValue\(entity\.properties\.league\) \|\| getMeaningfulValue\(entity\.properties\.level\)/)
  assert.match(leagueNavSource, /function getGroupTypeLabel\(groupType\?: LeagueData\['groupType'\]\)/)
  assert.match(leagueNavSource, /function getEntitySubtitle\(entity: Club, fallbackGroup\?: LeagueData \| null\)/)
  assert.match(leagueNavSource, /groupType: 'league' \| 'federation' \| 'organization' \| 'tournament' \| 'club' \| 'general';/)
  assert.match(leagueNavSource, /sport: string;/)
  assert.match(leagueNavSource, /selectedLeague\s*\?\s*`\$\{displaySport\} → \$\{displayLeague\?\.league\} → Entities`/)
  assert.match(leagueNavSource, /Choose a sport to browse leagues, federations, and entities/)
  assert.match(leagueNavSource, /getMeaningfulValue\(entity\.properties\.type\) \|\| 'Entity'/)
  assert.match(leagueNavSource, /getMeaningfulValue\(entity\.properties\.league\) \|\| getMeaningfulValue\(entity\.properties\.level\) \|\| fallbackGroup\?\.league \|\| getGroupTypeLabel\(fallbackGroup\?\.groupType\)/)
  assert.match(leagueNavSource, /getMeaningfulValue\(entity\.properties\.country\) \|\| fallbackGroup\?\.country \|\| 'International'/)
  assert.match(leagueNavSource, /league: summary\.league \|\| summary\.level/)
  assert.match(leagueNavSource, /const currentGroup = getEntityGroupInfo\(currentClub\)/)
  assert.match(leagueNavSource, /const currentSport = getMeaningfulValue\(currentClub\.properties\?\.sport\) \|\| 'Other Sports'/)
  assert.match(leagueNavSource, /group\.groupType === currentGroup\.groupType/)
  assert.match(leagueNavSource, /group\.league === currentGroup\.groupName/)
  assert.match(leagueNavSource, /return subtitleParts\.join\(' • '\)/)
  assert.match(leagueNavSource, /formatValue\(result\.entity\.properties\.name\)/)
  assert.match(leagueNavSource, /formatValue\(club\.properties\.name\)/)
  assert.match(leagueNavSource, /formatValue\(currentClub\?\.properties\?\.country\)/)
  assert.match(leagueNavSource, /if \(selectedLeague\) \{\s*setSelectedLeague\(null\)/)
  assert.match(leagueNavSource, /const newIndex = currentClubIndex > 0 \? currentClubIndex - 1 : currentLeague\.clubs\.length - 1/)
  assert.match(leagueNavSource, /const newIndex = currentClubIndex < currentLeague\.clubs\.length - 1 \? currentClubIndex \+ 1 : 0/)
  assert.match(leagueNavSource, /disabled=\{!currentLeague \|\| isNavigating\}/)
  assert.doesNotMatch(leagueNavSource, /disabled=\{!currentLeague \|\| currentClubIndex === 0 \|\| isNavigating\}/)
  assert.doesNotMatch(leagueNavSource, /disabled=\{!currentLeague \|\| currentClubIndex === currentLeague\.clubs\.length - 1 \|\| isNavigating\}/)
  assert.doesNotMatch(leagueNavSource, /setSelectedSport\(null\)\s*[\s\S]*navigateToClub\(league\.clubs\[0\]\)/)
})

test('entity page still renders the shared header shell', () => {
  assert.match(entityClientPageSource, /const Header = dynamic\(\(\) => import\("@\/components\/header\/Header"\), \{ ssr: false \}\)/)
  assert.match(entityClientPageSource, /<Header \/>/)
})

test('enhanced dossier only enables procurement and outreach fetches for active tabs', () => {
  assert.match(enhancedDossierSource, /<HypothesisStatesPanel entityId=\{entity\.id\} enabled=\{activeTab === ['"]procurement['"]\} \/>/)
  assert.match(enhancedDossierSource, /<OutreachStrategyPanel[\s\S]*enabled=\{activeTab === ['"]outreach['"]\}/)
})

test('enhanced dossier does not add artificial delay before connection analysis resolves', () => {
  assert.doesNotMatch(enhancedDossierSource, /await new Promise\(resolve => setTimeout\(resolve, 1000\)\)/)
})

test('enhanced dossier defers premium dossier generation until a premium tab is opened', () => {
  assert.match(enhancedDossierSource, /const PREMIUM_DOSSIER_TABS = new Set\(\[/)
  assert.match(enhancedDossierSource, /const shouldLoadPremiumDossier = PREMIUM_DOSSIER_TABS\.has\(activeTab\)/)
  assert.match(enhancedDossierSource, /if \(!shouldLoadPremiumDossier\) \{\s*generateEnhancedDossier\(\)/)
  assert.match(enhancedDossierSource, /if \(!shouldLoadPremiumDossier \|\| hasLoadedPremiumDossier\) return/)
})

test('enhanced club default dossier no longer hardcodes Arsenal-specific fallback copy', () => {
  assert.match(enhancedDossierSource, /const generateDefaultDossier = \(\): EnhancedClubDossier =>/)
  assert.doesNotMatch(enhancedDossierSource, /currentPartner: 'NTT DATA'/)
  assert.doesNotMatch(enhancedDossierSource, /Emirates Stadium/)
  assert.doesNotMatch(enhancedDossierSource, /Arsenal's digital structure is mature but rigid/)
  assert.doesNotMatch(enhancedDossierSource, /Juliet Slot|Mark Gonnella|Arsenal Women|Arsenal Mind/)
})

test('outreach strategy panel supports explicit lazy enablement', () => {
  assert.match(outreachSource, /enabled\?: boolean;/)
  assert.match(outreachSource, /if \(!enabled\) \{\s*setLoading\(false\);\s*return;\s*\}/)
}, { timeout: 1000 })

test('hypothesis state hooks disable eager polling and focus revalidation by default', () => {
  assert.match(hypothesisHookSource, /enabled\?: boolean;/)
  assert.match(hypothesisHookSource, /entityId && options\?\.enabled !== false \? url : null/)
  assert.match(hypothesisHookSource, /refreshInterval: options\?\.refreshInterval \?\? 0/)
  assert.match(hypothesisHookSource, /revalidateOnFocus: options\?\.revalidateOnFocus \?\? false/)
})

test('app navigation keeps the client sidebar visible on dossier and entity browser routes', () => {
  assert.doesNotMatch(appNavigationSource, /!isDossierRoute && !isEntityBrowserRoute/)
  assert.match(appNavigationSource, /<aside/)
})

test('app shell stays minimal and delegates layout to AppNavigation', () => {
  assert.match(appShellSource, /function AuthMenu\(\)/)
  assert.match(appShellSource, /<BackgroundAnimation \/>/)
  assert.match(appShellSource, /<AppNavigation authMenu=\{<AuthMenu \/>}/)
  assert.doesNotMatch(appShellSource, /CopilotKit|CopilotOverlay|TemporalIntelligenceTools|SimpleStreamingChat/)
})


test('dossier client defers ops-only panels instead of the core dossier renderer', () => {
  const dossierClientPageSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')
  assert.match(dossierClientPageSource, /const DossierOperatorControls = dynamic\(\(\) => import\(["']@\/components\/entity-dossier\/DossierOperatorControls["']\)/)
  assert.match(dossierClientPageSource, /const EntityEnrichmentSummaryCard = dynamic\(\(\) => import\(["']@\/components\/entity-enrichment\/EntityEnrichmentSummaryCard["']\)/)
  assert.match(dossierClientPageSource, /const EntityDossierRouter = dynamic\(\(\) => import\(["']@\/components\/entity-dossier\/EntityDossierRouter["']\), \{\s*ssr: true/s)
})
