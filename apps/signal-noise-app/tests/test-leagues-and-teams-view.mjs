import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sourcePath = new URL('../src/components/LeaguesAndTeamsView.tsx', import.meta.url)
const source = readFileSync(sourcePath, 'utf8')

test('leagues and teams view reads leagues from the shared canonical taxonomy', () => {
  assert.match(source, /import \{ useEntityTaxonomy \} from ['"]@\/lib\/swr-config['"]/)
  assert.match(source, /const \{ taxonomy, taxonomyLoading \} = useEntityTaxonomy\(\)/)
  assert.match(source, /const availableLeagues = taxonomy\?\.leagues \?\? \[\]/)
  assert.match(source, /leagueName: selectedLeague \|\| undefined/)
  assert.doesNotMatch(source, /useLeagues\(/)
})
