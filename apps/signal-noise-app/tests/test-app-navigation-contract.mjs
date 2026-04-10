import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('app navigation opens search as a full-screen vector modal instead of routing away', async () => {
  const navigationSource = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')
  const vectorSearchSource = await readFile(new URL('../src/components/ui/VectorSearch-debounced.tsx', import.meta.url), 'utf8')

  assert.match(navigationSource, /import VectorSearch from ['"]@\/components\/ui\/VectorSearch-debounced['"]/)
  assert.match(navigationSource, /item\.href === '\/search'/)
  assert.match(navigationSource, /<VectorSearch[^>]*variant="navitem"/)
  assert.doesNotMatch(navigationSource, /Search<\/span>[\s\S]*<Link href=\{item\.href\}/)

  assert.match(vectorSearchSource, /import \{ Dialog, DialogContent \} from ['"]@\/components\/ui\/dialog['"]/)
  assert.match(vectorSearchSource, /<Dialog open=\{isOpen\} onOpenChange=\{handleOpenChange\}>/)
  assert.match(vectorSearchSource, /<DialogContent[^>]*max-w-\[640px\]/)
  assert.match(vectorSearchSource, /<DialogContent[^>]*w-\[calc\(100vw-2rem\)\]/)
  assert.match(vectorSearchSource, /<DialogContent[^>]*rounded-2xl/)
  assert.match(vectorSearchSource, /<DialogContent[^>]*max-h-\[calc\(100vh-2rem\)\]/)
})
