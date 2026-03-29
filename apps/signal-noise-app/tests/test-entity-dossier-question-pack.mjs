import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierPageSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url), 'utf8')
const dossierClientSource = readFileSync(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')
const dossierRouterSource = readFileSync(new URL('../src/components/entity-dossier/EntityDossierRouter.tsx', import.meta.url), 'utf8')
const questionPackComponentSource = readFileSync(new URL('../src/components/entity-dossier/EntityQuestionPackRail.tsx', import.meta.url), 'utf8')
const finalClubDossierSource = readFileSync(new URL('../src/components/entity-dossier/FinalRalphClubDossier.tsx', import.meta.url), 'utf8')

test('entity dossier page fetches a canonical question pack alongside persisted dossier state', () => {
  assert.match(dossierPageSource, /getEntityQuestionPack/)
  assert.match(dossierPageSource, /getEntityGraphEpisodes/)
  assert.match(dossierPageSource, /initialQuestionPack=\{questionPack\}/)
  assert.match(dossierPageSource, /initialGraphEpisodes=\{graphEpisodes\}/)
})

test('entity dossier client page forwards the question pack into the dossier router', () => {
  assert.match(dossierClientSource, /initialQuestionPack\?: any \| null/)
  assert.match(dossierClientSource, /initialGraphEpisodes\?: EntityGraphEpisode\[\] \| null/)
  assert.match(dossierClientSource, /questionPack=\{initialQuestionPack\}/)
  assert.match(dossierClientSource, /graphEpisodes=\{initialGraphEpisodes \?\? \[\]\}/)
})

test('entity dossier router forwards the question pack into the final club dossier while keeping the phase rail outside', () => {
  assert.match(dossierRouterSource, /FinalRalphClubDossier/)
  assert.match(dossierRouterSource, /questionPack=\{questionPack\}/)
  assert.match(dossierRouterSource, /graphEpisodes=\{graphEpisodes\}/)
  assert.match(dossierRouterSource, /DossierPhaseRail/)
  assert.doesNotMatch(dossierRouterSource, /<EntityQuestionPackRail/)
})

test('final club dossier renders the question pack inside the tab system', () => {
  assert.match(finalClubDossierSource, /EntityQuestionPackRail/)
  assert.match(finalClubDossierSource, /TabsContent value="questions"/)
  assert.match(finalClubDossierSource, /TabsContent value="temporal-relational-context"/)
  assert.match(finalClubDossierSource, /graphEpisodes/)
  assert.match(finalClubDossierSource, /Timeline episodes/)
  assert.match(finalClubDossierSource, /source_url/)
  assert.match(finalClubDossierSource, /Open source/)
  assert.match(finalClubDossierSource, /buildHumanContextDossier/)
})

test('final club dossier renders fill-state badges in the tab list', () => {
  assert.match(finalClubDossierSource, /tab\.status/)
  assert.match(finalClubDossierSource, /<Badge/)
  assert.match(finalClubDossierSource, /applyLiveTabStatus/)
})

test('question pack rail explains the Yellow Panther fit prompts for each entity type', () => {
  assert.match(questionPackComponentSource, /yp_service_fit/)
  assert.match(questionPackComponentSource, /positioning_strategy/)
  assert.match(questionPackComponentSource, /question_count/)
  assert.match(questionPackComponentSource, /service-fit/i)
})

test('question pack rail surfaces persisted writeback metadata when available', () => {
  assert.match(questionPackComponentSource, /writeback/)
  assert.match(questionPackComponentSource, /Persisted writeback/i)
  assert.match(questionPackComponentSource, /artifact_path/)
})
