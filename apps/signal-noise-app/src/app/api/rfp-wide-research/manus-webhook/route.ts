import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ManusWebhookPayload = {
  id?: string
  task_id?: string
  taskId?: string
  task_url?: string
  taskUrl?: string
  url?: string
  data?: ManusWebhookPayload
  event?: string
  status?: string
  targetYear?: number | string | null
  target_year?: number | string | null
  researchMode?: 'live' | 'backtest'
  research_mode?: 'live' | 'backtest'
  researchDepth?: 'safe' | 'standard' | 'deep'
  research_depth?: 'safe' | 'standard' | 'deep'
  focusArea?: string
  focus_area?: string
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getWebhookSignature(request: NextRequest): string {
  return (
    toText(request.headers.get('x-manus-signature')) ||
    toText(request.headers.get('x-signature')) ||
    toText(request.headers.get('manus-signature')) ||
    toText(request.headers.get('signature'))
  )
}

function decodeSignature(value: string): Buffer {
  const signature = toText(value).replace(/^sha256=/i, '')
  if (!signature) return Buffer.alloc(0)
  if (/^[A-Za-z0-9+/=_-]+$/.test(signature)) {
    const normalized = signature.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(normalized, 'base64')
  }
  return Buffer.from(signature, 'hex')
}

function verifyWebhookRsaSignature(request: NextRequest, rawBody: string): boolean {
  const publicKey = toText(process.env.MANUS_WEBHOOK_PUBLIC_KEY).replace(/\\n/g, '\n')
  if (!publicKey) return false

  const signature = decodeSignature(getWebhookSignature(request))
  if (signature.length === 0) return false

  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(rawBody),
    publicKey,
    signature,
  )
}

function getWebhookSecret(request: NextRequest, body: ManusWebhookPayload): string {
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || ''
  return (
    toText(request.headers.get('x-manus-webhook-secret')) ||
    toText(request.headers.get('x-webhook-secret')) ||
    toText(bearer) ||
    toText(new URL(request.url).searchParams.get('secret')) ||
    toText((body as any).secret)
  )
}

function verifyWebhookSecret(request: NextRequest, body: ManusWebhookPayload): boolean {
  const expected = toText(process.env.MANUS_WEBHOOK_SECRET || process.env.RFP_MANUS_WEBHOOK_SECRET)
  if (!expected) return false

  const actual = getWebhookSecret(request, body)
  return Boolean(actual && timingSafeTextEqual(actual, expected))
}

function verifyWebhookRequest(request: NextRequest, rawBody: string, body: ManusWebhookPayload): 'rsa' | 'shared_secret' {
  if (verifyWebhookRsaSignature(request, rawBody)) {
    return 'rsa'
  }

  if (verifyWebhookSecret(request, body)) {
    return 'shared_secret'
  }

  const hasPublicKey = Boolean(toText(process.env.MANUS_WEBHOOK_PUBLIC_KEY))
  const hasSharedSecret = Boolean(toText(process.env.MANUS_WEBHOOK_SECRET || process.env.RFP_MANUS_WEBHOOK_SECRET))
  const error = new Error(hasPublicKey || hasSharedSecret
    ? 'Invalid Manus webhook signature or secret'
    : 'MANUS_WEBHOOK_PUBLIC_KEY or MANUS_WEBHOOK_SECRET is not configured')
  ;(error as any).status = 401
  throw error
}

function extractTaskIdFromUrl(value: string): string {
  const text = toText(value)
  if (!text) return ''

  try {
    const url = new URL(text)
    const parts = url.pathname.split('/').map((part) => part.trim()).filter(Boolean)
    return parts.at(-1) || ''
  } catch {
    const match = text.match(/(?:manus\.im\/app\/|tasks\/)([A-Za-z0-9_-]+)/)
    return match?.[1] || ''
  }
}

function extractManusTaskId(payload: ManusWebhookPayload): string {
  const candidates = [
    payload.task_id,
    payload.taskId,
    payload.id,
    payload.data?.task_id,
    payload.data?.taskId,
    payload.data?.id,
  ].map(toText)

  const direct = candidates.find(Boolean)
  if (direct) return direct

  return [
    payload.task_url,
    payload.taskUrl,
    payload.url,
    payload.data?.task_url,
    payload.data?.taskUrl,
    payload.data?.url,
  ]
    .map((value) => extractTaskIdFromUrl(toText(value)))
    .find(Boolean) || ''
}

function normalizeTargetYear(value: unknown): number | null {
  const parsed = Number.parseInt(toText(value), 10)
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null
  return parsed
}

async function importManusScheduledTask(request: NextRequest, payload: ManusWebhookPayload, taskId: string) {
  const response = await fetch(new URL('/api/rfp-wide-research', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      manusTaskId: taskId,
      targetYear: normalizeTargetYear(payload.targetYear || payload.target_year || payload.data?.targetYear || payload.data?.target_year) || new Date().getFullYear(),
      researchMode: payload.researchMode || payload.research_mode || payload.data?.researchMode || payload.data?.research_mode || 'live',
      researchDepth: payload.researchDepth || payload.research_depth || payload.data?.researchDepth || payload.data?.research_depth || 'deep',
      focusArea: payload.focusArea || payload.focus_area || payload.data?.focusArea || payload.data?.focus_area || 'web-platforms',
      currentRfpPage: '/rfps',
      currentIntakePage: '/rfps',
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(result?.error || result?.message || `Scheduled Manus import failed with ${response.status}`)
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload = (JSON.parse(rawBody || '{}')) as ManusWebhookPayload
    const signatureVerifiedBy = verifyWebhookRequest(request, rawBody, payload)

    const taskId = extractManusTaskId(payload)
    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: 'Manus webhook payload did not include task_id, taskId, id, or task_url' },
        { status: 400 },
      )
    }

    const importResult = await importManusScheduledTask(request, payload, taskId)
    const batch = importResult?.data || {}
    const metadata = batch?.prompt_execution_metadata || {}

    return NextResponse.json({
      ok: true,
      imported: true,
      task_id: taskId,
      run_id: batch.run_id || taskId,
      opportunities: Array.isArray(batch.opportunities) ? batch.opportunities.length : 0,
      artifact: importResult?.artifact || null,
      manus_task_url: metadata.manus_task_url || payload.task_url || payload.taskUrl || payload.url || null,
      manus_credit_usage: metadata.manus_credit_usage ?? null,
      signature_verified_by: signatureVerifiedBy,
      source: 'manus_webhook',
    })
  } catch (error) {
    const status = Number((error as any)?.status) || (/secret/i.test(error instanceof Error ? error.message : '') ? 401 : 500)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to import Manus scheduled task',
      },
      { status },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/rfp-wide-research/manus-webhook',
    method: 'POST',
    required_secret: 'MANUS_WEBHOOK_SECRET',
    public_key_env: 'MANUS_WEBHOOK_PUBLIC_KEY',
    signature_algorithm: 'RSA-SHA256',
    accepted_task_fields: ['task_id', 'taskId', 'id', 'task_url', 'taskUrl', 'url'],
  })
}
