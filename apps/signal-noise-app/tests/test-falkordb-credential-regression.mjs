import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const ignoredDirs = new Set([
  '.next',
  '.turbo',
  '.git',
  'node_modules',
  'tmp',
  'logs',
])
const checkedExtensions = new Set([
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.py',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.sh',
])

function extension(path) {
  const match = path.match(/\.[^.]+$/)
  return match ? match[0] : ''
}

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...listFiles(path))
    } else if (checkedExtensions.has(extension(path))) {
      files.push(path)
    }
  }
  return files
}

test('tracked source and docs do not contain concrete FalkorDB cloud credentials', () => {
  const offenders = []
  const leakedPassword = 'N' + '!HH@CBC9QDesFdS'
  const leakedHost = 'r-6jissuruar' + '.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud'

  for (const file of listFiles(root)) {
    const rel = relative(root, file)
    if (rel === 'tests/test-falkordb-credential-regression.mjs') continue
    const source = readFileSync(file, 'utf8')
    if (source.includes(leakedPassword)) {
      offenders.push(`${rel} contains leaked FalkorDB password`)
    }
    if (source.includes(leakedHost)) {
      offenders.push(`${rel} contains concrete FalkorDB cloud host`)
    }
    for (const line of source.split(/\r?\n/)) {
      if (
        line.includes('${FALKORDB_PASSWORD') ||
        line.includes('os.getenv("FALKORDB_PASSWORD")') ||
        line.includes("os.getenv('FALKORDB_PASSWORD')") ||
        line.includes('/FALKORDB_PASSWORD') ||
        line.includes('env.FALKORDB_PASSWORD')
      ) {
        continue
      }
      const match = line.match(/FALKORDB_PASSWORD\s*[:=]\s*["']?([^"'\s`]+)/)
      if (!match) continue
      const value = match[1]
      const allowed = [
        '',
        '${FALKORDB_PASSWORD}',
        '${FALKORDB_PASSWORD:-}',
        '${FALKORDB_PASSWORD:-falkordb}',
        '${FALKORDB_PASSWORD:}',
        '<your-falkordb-password>',
        '<falkordb-password>',
        'your-password',
        'your_falkordb_password',
        'your-falkordb-password',
        'your-falkordb-password-here',
        'FalkorDB',
        '#',
      ]
      if (
        !allowed.includes(value) &&
        !value.includes('${FALKORDB_PASSWORD') &&
        !value.includes('<falkordb-password>') &&
        !value.includes('text(env.FALKORDB_PASSWORD')
      ) {
        offenders.push(`${rel} contains concrete FALKORDB_PASSWORD value`)
      }
    }
  }

  assert.deepEqual(offenders, [])
})
