import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type MaintenanceStep = {
  command: string
  durationMs: number
}

export type PostImportCanonicalMaintenanceResult = {
  skipped: boolean
  cwd: string
  syncRunId: string | null
  status: 'passed' | 'failed' | 'skipped'
  steps: MaintenanceStep[]
  durationMs: number
}

type PostImportCanonicalMaintenanceOptions = {
  syncRunId?: string
  metadata?: Record<string, unknown>
}

const MAINTENANCE_COMMANDS = [
  'npm run remediate:canonical-congruence',
  'npm run remediate:taxonomy-hygiene',
  'npm run qa:canonical-congruence',
]

const MAINTENANCE_TIMEOUT_MS = 20 * 60 * 1000

const supabaseAuditUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAuditKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseAuditClient =
  supabaseAuditUrl && supabaseAuditKey
    ? createClient(supabaseAuditUrl, supabaseAuditKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

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
  return runPostImportCanonicalMaintenanceWithOptions(trigger, {})
}

async function persistMaintenanceAudit(params: {
  syncRunId: string
  trigger: string
  status: 'passed' | 'failed' | 'skipped'
  startedAtIso: string
  durationMs: number
  steps: MaintenanceStep[]
  errorMessage?: string
  metadata?: Record<string, unknown>
}) {
  if (!supabaseAuditClient) {
    return
  }

  await supabaseAuditClient.from('canonical_maintenance_audit').insert({
    sync_run_id: params.syncRunId,
    trigger: params.trigger,
    status: params.status,
    started_at: params.startedAtIso,
    completed_at: new Date().toISOString(),
    duration_ms: params.durationMs,
    steps: params.steps,
    error_message: params.errorMessage || null,
    metadata: params.metadata || {},
  })
}

async function sendFailureAlerts(params: {
  syncRunId: string
  trigger: string
  durationMs: number
  steps: MaintenanceStep[]
  errorMessage: string
  metadata?: Record<string, unknown>
}) {
  const webhookUrl =
    process.env.CANONICAL_MAINTENANCE_ALERT_WEBHOOK_URL ||
    process.env.SLACK_WEBHOOK_URL ||
    ''

  const text = [
    'Canonical maintenance failed',
    `syncRunId=${params.syncRunId}`,
    `trigger=${params.trigger}`,
    `durationMs=${params.durationMs}`,
    `error=${params.errorMessage}`,
  ].join(' | ')

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          syncRunId: params.syncRunId,
          trigger: params.trigger,
          durationMs: params.durationMs,
          steps: params.steps,
          error: params.errorMessage,
          metadata: params.metadata || {},
        }),
      })
    } catch (error) {
      console.error('Failed to deliver canonical maintenance webhook alert', error)
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY || ''
  const alertEmailTo = process.env.CANONICAL_MAINTENANCE_ALERT_EMAIL_TO || ''
  const alertEmailFrom = process.env.CANONICAL_MAINTENANCE_ALERT_EMAIL_FROM || 'alerts@yellowpanther.ai'
  if (resendApiKey && alertEmailTo) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: alertEmailFrom,
          to: [alertEmailTo],
          subject: `Canonical maintenance failed (${params.trigger})`,
          text: `${text}\nsteps=${JSON.stringify(params.steps)}\nmetadata=${JSON.stringify(params.metadata || {})}`,
        }),
      })
    } catch (error) {
      console.error('Failed to deliver canonical maintenance email alert', error)
    }
  }
}

export async function runPostImportCanonicalMaintenanceWithOptions(
  trigger: string,
  options: PostImportCanonicalMaintenanceOptions,
): Promise<PostImportCanonicalMaintenanceResult> {
  const isDisabled = process.env.SKIP_CANONICAL_POST_IMPORT_MAINTENANCE === '1'
  const cwd = resolveAppCwd()
  const startedAt = Date.now()
  const startedAtIso = new Date(startedAt).toISOString()
  const syncRunId = options.syncRunId || null
  if (isDisabled && process.env.NODE_ENV === 'production') {
    throw new Error('SKIP_CANONICAL_POST_IMPORT_MAINTENANCE cannot be enabled in production')
  }
  if (isDisabled) {
    const durationMs = Date.now() - startedAt
    if (syncRunId) {
      await persistMaintenanceAudit({
        syncRunId,
        trigger,
        status: 'skipped',
        startedAtIso,
        durationMs,
        steps: [],
        metadata: options.metadata,
      })
    }
    return {
      skipped: true,
      cwd,
      syncRunId,
      status: 'skipped',
      steps: [],
      durationMs,
    }
  }

  const steps: MaintenanceStep[] = []
  try {
    for (const command of MAINTENANCE_COMMANDS) {
      const step = await runShellCommand(command, cwd)
      steps.push(step)
    }
    const durationMs = Date.now() - startedAt
    if (syncRunId) {
      await persistMaintenanceAudit({
        syncRunId,
        trigger,
        status: 'passed',
        startedAtIso,
        durationMs,
        steps,
        metadata: options.metadata,
      })
    }

    console.log('✅ Post-import canonical maintenance complete', {
      trigger,
      cwd,
      syncRunId,
      steps,
    })

    return {
      skipped: false,
      cwd,
      syncRunId,
      status: 'passed',
      steps,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (syncRunId) {
      await persistMaintenanceAudit({
        syncRunId,
        trigger,
        status: 'failed',
        startedAtIso,
        durationMs,
        steps,
        errorMessage,
        metadata: options.metadata,
      })

      await sendFailureAlerts({
        syncRunId,
        trigger,
        durationMs,
        steps,
        errorMessage,
        metadata: options.metadata,
      })
    }
    throw error
  }
}
