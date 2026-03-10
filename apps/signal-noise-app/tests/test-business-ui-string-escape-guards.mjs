import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const signInFormSource = readFileSync(
  new URL('../src/components/auth/SignInForm.tsx', import.meta.url),
  'utf8'
)

const tendersPageSource = readFileSync(
  new URL('../src/app/tenders/page.tsx', import.meta.url),
  'utf8'
)

const entityBrowserComplexPageSource = readFileSync(
  new URL('../src/app/entity-browser/complex-page.tsx', import.meta.url),
  'utf8'
)

const entityDetailTabsSource = readFileSync(
  new URL('../src/components/entity-detail-tabs/EntityDetailTabs.tsx', import.meta.url),
  'utf8'
)

const clubDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/ClubDossier.tsx', import.meta.url),
  'utf8'
)

const enhancedClubDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/EnhancedClubDossier.tsx', import.meta.url),
  'utf8'
)

const accordionEnhancedClubDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/AccordionEnhancedClubDossier.tsx', import.meta.url),
  'utf8'
)

const enhancedArsenalDossierSource = readFileSync(
  new URL('../src/components/entity-dossier/EnhancedArsenalDossier.tsx', import.meta.url),
  'utf8'
)

test('sign-in form keeps apostrophe escaped in business auth copy', () => {
  assert.match(signInFormSource, /Don&apos;t have an account\?/)
})

test('tenders and entity-browser pages keep business copy quote/apostrophe escaped', () => {
  assert.match(tendersPageSource, /We&apos;ve filtered out opportunities/)

  assert.match(entityBrowserComplexPageSource, /Click &quot;Generate Intelligence Dossier&quot;/)
})

test('entity detail tabs keep contact enrichment copy escaped', () => {
  assert.match(entityDetailTabsSource, /hasn&apos;t been enriched/)
})

test('dossier views keep user-facing copy escaped in active club/person slices', () => {
  assert.match(clubDossierSource, /person&apos;s name/)

  assert.match(enhancedClubDossierSource, /&quot;\{person\.communicationProfile\?\.tone/)
  assert.match(enhancedClubDossierSource, /haven&apos;t been identified/)

  assert.match(accordionEnhancedClubDossierSource, /Arsenal&apos;s digital structure/)
  assert.match(accordionEnhancedClubDossierSource, /women&apos;s football digital ecosystem/)
  assert.match(accordionEnhancedClubDossierSource, /&quot;lightweight experimental R&amp;D wing&quot;/)
  assert.match(accordionEnhancedClubDossierSource, /&quot;Professional, outcome-driven, values storytelling&quot;/)

  assert.match(enhancedArsenalDossierSource, /Arsenal&apos;s digital structure/)
  assert.match(enhancedArsenalDossierSource, /women&apos;s football demonstrates/)
})
