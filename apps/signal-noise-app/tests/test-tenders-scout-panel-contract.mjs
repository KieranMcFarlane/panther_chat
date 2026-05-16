import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('legacy tenders page route is removed in favor of canonical rfps', async () => {
  await assert.rejects(
    access(new URL('../src/app/tenders/page.tsx', import.meta.url)),
    /ENOENT/,
  )
  await assert.rejects(
    access(new URL('../src/app/tenders/loading.tsx', import.meta.url)),
    /ENOENT/,
  )
})

test('rfps page owns the Manus wide research control', async () => {
  const pageSource = await readFile(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')
  const refreshButtonSource = await readFile(new URL('../src/components/rfp/WideResearchRefreshButton.tsx', import.meta.url), 'utf8')

  assert.match(pageSource, /WideResearchRefreshButton/)
  assert.match(pageSource, /Merged Manus wide research batch/)
  assert.match(refreshButtonSource, /Run Manus scout now/)
  assert.match(refreshButtonSource, /currentRfpPage: '\/rfps'/)
  assert.doesNotMatch(refreshButtonSource, /currentIntakePage: '\/tenders'/)
})
