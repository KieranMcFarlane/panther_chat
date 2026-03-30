import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../src/components/EntityCard.tsx', import.meta.url)), 'utf8')

assert.match(source, /resolveGraphId\(entity\)/, 'EntityCard should resolve browser dossier ids through the shared graph-id helper')
assert.match(source, /\/entity-browser\/\$\{stableEntityId\}\/dossier\?from=\$\{currentPage\}/, 'EntityCard should route to the browser dossier path')
assert.match(source, /data-testid="view-full-profile"/, 'EntityCard should keep the explicit dossier CTA')

