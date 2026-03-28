import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

test('runtime graphiti code does not reference context7-mcp', () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const roots = ['src/app', 'src/lib', 'backend'].filter((root) => existsSync(`${projectRoot}/${root}`))
  const result = spawnSync('rg', ['-n', 'context7', ...roots], {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  assert.ok(result.status === 1 || result.status === 0)
  assert.equal(String(result.stdout || '').trim(), '')
})
