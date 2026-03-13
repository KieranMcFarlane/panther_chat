import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type MaintenanceStep = {
  command: string
  durationMs: number
}

export type PostImportCanonicalMaintenanceResult = {
  skipped: boolean
  cwd: string
  steps: MaintenanceStep[]
}

const MAINTENANCE_COMMANDS = [
  'npm run remediate:canonical-congruence',
  'npm run qa:canonical-congruence',
]

const MAINTENANCE_TIMEOUT_MS = 20 * 60 * 1000

function resolveAppCwd(): string {
  const cwd = process.cwd()
  const nestedAppDir = path.join(cwd, 'apps', 'signal-noise-app')
  if (existsSync(path.join(nestedAppDir, 'package.json'))) {
    return nestedAppDir
  }
  return cwd
}

function runShellCommand(command: string, cwd: string): Promise<MaintenanceStep> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Timed out running "${command}" after ${MAINTENANCE_TIMEOUT_MS}ms`))
    }, MAINTENANCE_TIMEOUT_MS)

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`Command failed (${code}): ${command}\n${stderr.trim()}`))
        return
      }
      resolve({
        command,
        durationMs: Date.now() - startedAt,
      })
    })
  })
}

export async function runPostImportCanonicalMaintenance(trigger: string): Promise<PostImportCanonicalMaintenanceResult> {
  const isDisabled = process.env.SKIP_CANONICAL_POST_IMPORT_MAINTENANCE === '1'
  const cwd = resolveAppCwd()
  if (isDisabled) {
    return {
      skipped: true,
      cwd,
      steps: [],
    }
  }

  const steps: MaintenanceStep[] = []
  for (const command of MAINTENANCE_COMMANDS) {
    const step = await runShellCommand(command, cwd)
    steps.push(step)
  }

  console.log('✅ Post-import canonical maintenance complete', {
    trigger,
    cwd,
    steps,
  })

  return {
    skipped: false,
    cwd,
    steps,
  }
}
